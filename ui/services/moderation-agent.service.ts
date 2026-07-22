import { Errors } from "@/lib/errors";
import { UNCERTAIN_REPLY } from "@/lib/messages";
import {
  formatCeloKnowledgeForPrompt,
  looksCeloRelated,
} from "@/lib/celo-knowledge";
import { employmentAgreementPromptBrief } from "@/lib/employment-agreement";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ModerationDecision = {
  action: "ignore" | "warn" | "delete" | "mute" | "ban";
  reason: string;
  confidence: number;
};

const DEFAULT_REPLY_TOKENS = 2048;
const SHORT_REPLY_TOKENS = 400;

const DEFAULT_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

const GEMINI_MODEL_CANDIDATES = [
  process.env.TEXT_GENERATION_MODEL,
  process.env.GEMINI_MODEL,
  ...DEFAULT_GEMINI_MODELS,
].filter((model, index, all): model is string => !!model && all.indexOf(model) === index);

function geminiApiKey() {
  return (
    process.env.GEM_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.REACT_APP_GEMINI_API_KEY ||
    ""
  ).trim();
}

function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms);
  });
}

async function callOpenAI(messages: ChatMessage[], maxTokens = DEFAULT_REPLY_TOKENS) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: maxTokens,
        messages,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("OpenAI returned empty content");
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini(messages: ChatMessage[], maxTokens = DEFAULT_REPLY_TOKENS) {
  const apiKey = geminiApiKey();
  if (!apiKey) throw new Error("Gemini API key not configured");
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const conversation = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
  const prompt = system ? `${system}\n\n---\n\n${conversation}` : conversation;
  const envModel = process.env.TEXT_GENERATION_MODEL || process.env.GEMINI_MODEL;
  const modelsToTry = envModel
    ? [envModel, ...GEMINI_MODEL_CANDIDATES.filter((m) => m !== envModel)]
    : GEMINI_MODEL_CANDIDATES;
  let lastError: unknown = null;
  for (const modelName of modelsToTry) {
    try {
      const generationConfig: Record<string, unknown> = {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: Math.max(maxTokens, 1024),
      };
      if (modelName.includes("2.5")) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: generationConfig as {
          temperature: number;
          topK: number;
          topP: number;
          maxOutputTokens: number;
        },
      });
      const response = await Promise.race([
        model.generateContent(prompt).then((r) => r.response),
        createTimeoutPromise(45_000),
      ]);
      const text = response.text()?.trim();
      if (!text) throw new Error("Gemini returned empty content");
      return text;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Gemini failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

async function callLLM(messages: ChatMessage[], maxTokens = DEFAULT_REPLY_TOKENS) {
  if (process.env.OPENAI_API_KEY?.trim()) {
    try {
      return await callOpenAI(messages, maxTokens);
    } catch (err) {
      console.warn("[ai] OpenAI failed, trying Gemini:", err);
    }
  }
  if (geminiApiKey()) {
    try {
      return await callGemini(messages, maxTokens);
    } catch (err) {
      console.warn("[ai] Gemini failed:", err);
    }
  }
  throw Errors.aiUnavailable();
}

export { callLLM };

export class ModerationAgent {
  /**
   * Heuristic pre-filter + LLM decision for warn / delete / mute / ban.
   */
  async decide(input: {
    text: string;
    groupName: string;
    groupRules?: string | null;
    fromUsername?: string | null;
    heuristic: { spam: boolean; reason?: string; confidence: number };
  }): Promise<ModerationDecision> {
    // High-confidence obvious scam → delete without spending an LLM call.
    if (input.heuristic.spam && input.heuristic.confidence >= 0.95) {
      return {
        action: "delete",
        reason: input.heuristic.reason ?? "scam",
        confidence: input.heuristic.confidence,
      };
    }

    const hasLink = /https?:\/\/|t\.me\//i.test(input.text);
    // Skip LLM when clearly clean and no invite/URL risk.
    if (!input.heuristic.spam && input.heuristic.confidence < 0.4 && !hasLink) {
      return { action: "ignore", reason: "clean", confidence: 0.1 };
    }

    try {
      const raw = await callLLM(
        [
          {
            role: "system",
            content: [
              "You are Sentry's moderation agent for a Telegram community.",
              "Decide one action for the member message. Reply with JSON only:",
              '{"action":"ignore"|"warn"|"delete"|"mute"|"ban","reason":"short","confidence":0-1}',
              "Use mute/ban only for clear scams, harassment, or repeated abuse.",
              "Prefer delete for spam links; warn for borderline content; ignore for normal chat.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              `Group: ${input.groupName}`,
              `Rules: ${input.groupRules ?? "(none)"}`,
              `Member: ${input.fromUsername ?? "unknown"}`,
              `Heuristic: spam=${input.heuristic.spam} reason=${input.heuristic.reason ?? "n/a"} conf=${input.heuristic.confidence}`,
              `Message:\n${input.text.slice(0, 1500)}`,
            ].join("\n"),
          },
        ],
        200,
      );
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("no json");
      const parsed = JSON.parse(match[0]) as ModerationDecision;
      const action = ["ignore", "warn", "delete", "mute", "ban"].includes(parsed.action)
        ? parsed.action
        : "warn";
      return {
        action,
        reason: String(parsed.reason ?? input.heuristic.reason ?? "moderation").slice(0, 200),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.7)),
      };
    } catch {
      if (input.heuristic.spam) {
        return {
          action: input.heuristic.confidence >= 0.85 ? "delete" : "warn",
          reason: input.heuristic.reason ?? "heuristic",
          confidence: input.heuristic.confidence,
        };
      }
      return { action: "ignore", reason: "agent_unavailable", confidence: 0 };
    }
  }
}

export const moderationAgent = new ModerationAgent();

/** Employment-agreement + role awareness for employer DMs. */
export function employerSystemPrompt(extras?: { operationalBrief?: string }) {
  return [
    "You are Sentry, a hireable AI community employee on Telegram, paid from a prepaid Celo employment wallet.",
    "You work for this employer across their enabled groups: answer FAQs, moderate spam (warn/delete/mute/ban when admin), welcome members, send reports.",
    "You CAN remove spam and track moderation actions — never claim you cannot moderate if they hired you for community work.",
    "When asked about spam removed / work done, use the operational data below; count spam_moderation actions and actionTaken delete/mute/ban.",
    "Explain employment plainly: hire requires Accepting the Employment Agreement; Reject cancels hire with no action; then fund wallet → enable groups → bill per completed action on Celo.",
    "When asked for the agreement/contract/terms, provide or summarize the official Employment Agreement and remind them of /agreement in DM.",
    "Tone: warm, capable colleague — not a generic chatbot. Complete answers; never invent metrics.",
    employmentAgreementPromptBrief(),
    formatCeloKnowledgeForPrompt(),
    extras?.operationalBrief
      ? `\nOperational data (ground truth):\n${extras.operationalBrief}`
      : "",
    `If truly unknown after data: ${UNCERTAIN_REPLY}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateEmployerWelcome(input: {
  displayName?: string;
  operationalBrief: string;
}) {
  return callLLM(
    [
      {
        role: "system",
        content: employerSystemPrompt({ operationalBrief: input.operationalBrief }),
      },
      {
        role: "user",
        content: [
          `Employer display name: ${input.displayName ?? "employer"}`,
          "Write a short warm welcome (3–5 sentences) as their newly hired Telegram employee.",
          "Mention you can use the menu buttons or chat naturally. Vary wording; do not sound templated.",
          "Reference one concrete fact from operational data if available (groups, balance, or recent work).",
        ].join("\n"),
      },
    ],
    SHORT_REPLY_TOKENS,
  );
}

export async function generateEmployerAnswer(input: {
  question: string;
  displayName?: string;
  operationalBrief: string;
}) {
  const celo = looksCeloRelated(input.question)
    ? `\n\nCelo context:\n${formatCeloKnowledgeForPrompt()}`
    : "";
  return callLLM(
    [
      {
        role: "system",
        content: employerSystemPrompt({ operationalBrief: input.operationalBrief }),
      },
      {
        role: "user",
        content: [
          `Employer (${input.displayName ?? "employer"}) asks:`,
          input.question,
          celo,
          "",
          "Answer completely using operational data. If they ask about spam/moderation capacity, describe what you actually do in groups.",
        ].join("\n"),
      },
    ],
    DEFAULT_REPLY_TOKENS,
  );
}

export async function generateWorkReportNarrative(input: {
  groupName: string;
  statsBlock: string;
}) {
  return callLLM(
    [
      {
        role: "system",
        content:
          "You are Sentry writing a concise employer work report for a Telegram community. Use only provided stats. 5–10 short bullets.",
      },
      {
        role: "user",
        content: `Group: ${input.groupName}\n\n${input.statsBlock}`,
      },
    ],
    800,
  );
}
