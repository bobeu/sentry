import {
  GoogleGenerativeAI,
  type GenerateContentResult,
} from "@google/generative-ai";
import type { ContextBundle } from "@/services/context.service";
import { faqService } from "@/services/faq.service";
import { knowledgeService } from "@/services/knowledge.service";
import { Errors } from "@/lib/errors";
import { UNCERTAIN_REPLY } from "@/lib/messages";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ReplyInput = {
  context: ContextBundle;
  userQuestion: string;
  userName?: string;
  /** When false, FAQ hits are context/tools only — never short-circuit the agent. */
  preferFaq?: boolean;
  playbookRules?: string;
  personaRole?: string | null;
  personaTone?: string | null;
  memberNote?: string | null;
  groupId?: string;
};

/** Default completion budget. Gemini 2.5 thinking can consume part of this. */
const DEFAULT_REPLY_TOKENS = 2048;
const LONG_REPLY_TOKENS = 3072;
const SHORT_REPLY_TOKENS = 256;

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

function systemRules(extras?: {
  playbookRules?: string;
  personaRole?: string | null;
  personaTone?: string | null;
  memberNote?: string | null;
}) {
  const parts = [
    "You are Sentry, a highly capable AI agent embedded in Telegram as a community employee.",
    "You are not a shallow chatbot: reason carefully, use FAQs, knowledge-base tool results, and recent chat context.",
    "Tone: clear, confident, and complete. Prefer short paragraphs over one-liners when detail is needed.",
    "Always finish your answer — never stop mid-sentence or mid-list. If space is tight, prioritize completeness over fluff.",
    "Never invent policies or facts. Prefer FAQs and knowledge-base excerpts over speculation.",
    "Never claim to be human.",
    `If uncertain after using available context/tools: ${UNCERTAIN_REPLY}`,
  ];
  if (extras?.personaRole && extras.personaRole !== "default") {
    parts.push(
      `Persona role for this group: ${extras.personaRole}.` +
        (extras.personaTone ? ` Tone guidance: ${extras.personaTone}.` : ""),
    );
  }
  if (extras?.playbookRules) {
    parts.push(`Employer playbook rules (must follow):\n${extras.playbookRules}`);
  }
  if (extras?.memberNote) {
    parts.push(`Consented member memory note: ${extras.memberNote}`);
  }
  return parts.join(" ");
}

function employerSystemRules() {
  return [
    systemRules(),
    "This is a private DM with the employer who hired you.",
    "You can explain past work, group status, wallet/funding needs, and draft community replies.",
    "When operational data is provided below, ground your answer in it. Do not invent metrics.",
  ].join(" ");
}

function formatContext(context: ContextBundle) {
  const recent = context.recentMessages
    .slice(-25)
    .map((m) => `${m.from}: ${m.text}`)
    .join("\n");
  const faqs = context.faqs
    .slice(0, 20)
    .map((f, i) => `${i + 1}. Q: ${f.question}\n   A: ${f.answer}`)
    .join("\n");
  const kb = (context.knowledgeSources ?? [])
    .slice(0, 10)
    .map((s) => `- ${s.title}${s.url ? ` (${s.url})` : ""} [${s.status}]`)
    .join("\n");

  return [
    `Group: ${context.groupName}`,
    `Purpose: ${context.purpose ?? "(none)"}`,
    `Description: ${context.description ?? "(none)"}`,
    `Rules: ${context.rules ?? "(none)"}`,
    `FAQs:\n${faqs || "(none)"}`,
    `Knowledge sources:\n${kb || "(none)"}`,
    `Recent messages:\n${recent || "(none)"}`,
  ].join("\n\n");
}

function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms);
  });
}

async function callOpenAI(messages: ChatMessage[], maxTokens = DEFAULT_REPLY_TOKENS) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

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
      choices?: Array<{
        message?: { content?: string };
        finish_reason?: string;
      }>;
    };
    const choice = data.choices?.[0];
    const text = choice?.message?.content?.trim();
    if (!text) throw new Error("OpenAI returned empty content");
    if (choice?.finish_reason === "length") {
      console.warn("[ai] OpenAI truncated at max_tokens; returning partial reply");
    }
    return text;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("OpenAI request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini(messages: ChatMessage[], maxTokens = DEFAULT_REPLY_TOKENS) {
  const apiKey = geminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const conversation = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
  const prompt = system
    ? `${system}\n\n---\n\n${conversation}`
    : conversation;

  const envModel = process.env.TEXT_GENERATION_MODEL || process.env.GEMINI_MODEL;
  const modelsToTry = envModel
    ? [envModel, ...GEMINI_MODEL_CANDIDATES.filter((m) => m !== envModel)]
    : GEMINI_MODEL_CANDIDATES;

  let lastError: unknown = null;
  const maxRetries = 2;

  for (const modelName of modelsToTry) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Gemini 2.5 "thinking" can consume output budget; leave headroom for the visible reply.
        const generationConfig: Record<string, unknown> = {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: Math.max(maxTokens, 2048),
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

        const generatePromise = model
          .generateContent(prompt)
          .then((result: GenerateContentResult) => result.response);
        const response = await Promise.race([
          generatePromise,
          createTimeoutPromise(45_000),
        ]);
        const text = response.text()?.trim();
        if (!text) throw new Error("Gemini returned empty content");
        return text;
      } catch (error: unknown) {
        lastError = error;
        const errorMessage =
          error instanceof Error ? error.message : String(error ?? "");
        const errorString = errorMessage.toLowerCase();
        const isModelNotFound =
          errorString.includes("404") ||
          errorString.includes("not found") ||
          errorString.includes("model not found");
        const isThinkingUnsupported =
          errorString.includes("thinking") ||
          errorString.includes("thinkingconfig") ||
          errorString.includes("unknown name");
        const isRateLimit =
          errorString.includes("429") ||
          errorString.includes("rate limit") ||
          errorString.includes("quota");
        const isNetworkError =
          errorString.includes("fetch failed") ||
          errorString.includes("network") ||
          errorString.includes("timeout") ||
          errorString.includes("econnreset") ||
          errorString.includes("enotfound") ||
          errorString.includes("econnrefused");

        if (isThinkingUnsupported && attempt === 0) {
          // Retry same model without thinkingConfig via higher-level loop by clearing flag once.
          console.warn(`[ai] Gemini ${modelName} rejected thinkingConfig; retrying plain`);
          try {
            const model = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: {
                temperature: 0.3,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: Math.max(maxTokens, 2048),
              },
            });
            const response = await Promise.race([
              model.generateContent(prompt).then((r) => r.response),
              createTimeoutPromise(45_000),
            ]);
            const text = response.text()?.trim();
            if (!text) throw new Error("Gemini returned empty content");
            return text;
          } catch (inner) {
            lastError = inner;
          }
        }

        if (isModelNotFound) {
          console.warn(`[ai] Gemini model ${modelName} not found, trying next`);
          break;
        }
        if ((isRateLimit || isNetworkError) && attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.warn(
            `[ai] Gemini ${modelName} retry in ${waitTime}ms (${errorMessage.slice(0, 120)})`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }
        if (attempt === maxRetries) {
          console.warn(`[ai] Gemini model ${modelName} failed, trying next`);
          break;
        }
      }
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : String(lastError ?? "unknown");
  throw new Error(`Gemini failed after all models: ${detail}`);
}

/**
 * Prefer OpenAI; fall back to Google Gemini (vibeService-style model retries).
 */
async function callLLM(messages: ChatMessage[], maxTokens = DEFAULT_REPLY_TOKENS) {
  const errors: string[] = [];

  if (process.env.OPENAI_API_KEY?.trim()) {
    try {
      return await callOpenAI(messages, maxTokens);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`openai: ${msg}`);
      console.warn("[ai] OpenAI failed, trying Gemini:", msg);
    }
  } else {
    errors.push("openai: not configured");
  }

  if (geminiApiKey()) {
    try {
      return await callGemini(messages, maxTokens);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`gemini: ${msg}`);
      console.warn("[ai] Gemini failed:", msg);
    }
  } else {
    errors.push("gemini: not configured");
  }

  console.error("[ai] all providers failed", errors.join(" | "));
  throw Errors.aiUnavailable();
}

/**
 * Run agent tools (FAQ + knowledge search) then draft a complete reply.
 * Every billable group answer should go through this path.
 */
async function gatherAgentTools(input: {
  groupId?: string;
  context: ContextBundle;
  userQuestion: string;
}) {
  const toolLines: string[] = [];

  const faqHit = faqService.matchDetailed(input.context.faqs, input.userQuestion);
  if (faqHit) {
    toolLines.push(
      `[tool:search_faqs] score=${faqHit.score.toFixed(2)}\nQ: ${faqHit.question}\nA: ${faqHit.answer}`,
    );
  } else {
    toolLines.push("[tool:search_faqs] (no strong FAQ match)");
  }

  if (input.groupId) {
    try {
      const hits = await knowledgeService.search(input.groupId, input.userQuestion, 6);
      toolLines.push(
        `[tool:search_knowledge]\n${knowledgeService.formatHitsForPrompt(hits)}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toolLines.push(`[tool:search_knowledge] error: ${msg}`);
    }
  } else if ((input.context.knowledgeSources ?? []).length > 0) {
    toolLines.push(
      "[tool:search_knowledge] (groupId missing — list only)\n" +
        (input.context.knowledgeSources ?? [])
          .map((s) => `- ${s.title}`)
          .join("\n"),
    );
  } else {
    toolLines.push("[tool:search_knowledge] (no sources configured)");
  }

  return { faqHit, toolBlock: toolLines.join("\n\n") };
}

export class AiService {
  async answerFAQ(context: ContextBundle, userQuestion: string) {
    return faqService.match(context.faqs, userQuestion);
  }

  async generateReply(input: ReplyInput) {
    const preferFaq = input.preferFaq === true;
    const groupId = input.groupId ?? input.context.groupId;
    const { faqHit, toolBlock } = await gatherAgentTools({
      groupId,
      context: input.context,
      userQuestion: input.userQuestion,
    });

    // Only short-circuit when explicitly requested (e.g. unfunded FAQ-only path).
    if (preferFaq && faqHit && faqHit.score >= 0.72) {
      return { text: faqHit.answer, viaFaq: true as const };
    }

    const rules = systemRules({
      playbookRules: input.playbookRules,
      personaRole: input.personaRole,
      personaTone: input.personaTone,
      memberNote: input.memberNote,
    });

    const text = await callLLM(
      [
        { role: "system", content: rules },
        {
          role: "user",
          content: [
            formatContext(input.context),
            "",
            "Agent tool results (use these to narrow and ground your reply):",
            toolBlock,
            "",
            `User (${input.userName ?? "member"}) asked:`,
            input.userQuestion,
            "",
            "Write a complete, helpful reply grounded in the tool results and group context.",
            "Use as many sentences or short paragraphs as needed — do not cut off mid-thought.",
            "If tool results fully answer the question, prefer them. If not, say what is known and what is not.",
          ].join("\n"),
        },
      ],
      DEFAULT_REPLY_TOKENS,
    );
    return {
      text,
      viaFaq: Boolean(faqHit && faqHit.score >= 0.72),
    };
  }

  async generateWelcome(input: { context: ContextBundle; memberName: string }) {
    return callLLM(
      [
        { role: "system", content: systemRules() },
        {
          role: "user",
          content: `${formatContext(input.context)}\n\nWrite a friendly welcome for "${input.memberName}". Max 1-2 sentences.`,
        },
      ],
      SHORT_REPLY_TOKENS,
    );
  }

  async generateDailySummary(context: ContextBundle) {
    return callLLM(
      [
        { role: "system", content: systemRules() },
        {
          role: "user",
          content: `${formatContext(context)}\n\nWrite a daily summary as 5-10 bullet points covering important discussions, questions, decisions, and unanswered questions. Finish every bullet completely.`,
        },
      ],
      LONG_REPLY_TOKENS,
    );
  }

  async generateMentionDigest(input: {
    context: ContextBundle;
    mentionedUsername: string;
    triggerText: string;
  }) {
    return callLLM(
      [
        { role: "system", content: systemRules() },
        {
          role: "user",
          content: `${formatContext(input.context)}\n\n@${input.mentionedUsername} was mentioned:\n"${input.triggerText}"\n\nWrite a private notification with Summary and Recommended action. Max 3 sentences.`,
        },
      ],
      SHORT_REPLY_TOKENS,
    );
  }

  async generatePersonalReply(input: {
    userQuestion: string;
    userName?: string;
    employerEmail: string;
    operationalBrief?: string;
  }) {
    return callLLM(
      [
        { role: "system", content: employerSystemRules() },
        {
          role: "user",
          content: [
            `Employer: ${input.employerEmail}`,
            `User: ${input.userName ?? "employer"}`,
            "Channel: private Telegram DM with Sentry agent.",
            input.operationalBrief
              ? `Operational data:\n${input.operationalBrief}`
              : "Operational data: (none loaded)",
            "",
            `Request:\n${input.userQuestion}`,
            "",
            "Reply completely — do not truncate mid-sentence.",
          ].join("\n"),
        },
      ],
      DEFAULT_REPLY_TOKENS,
    );
  }
}

export const aiService = new AiService();
