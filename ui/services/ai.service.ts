import {
  GoogleGenerativeAI,
  type GenerateContentResult,
} from "@google/generative-ai";
import type { ContextBundle } from "@/services/context.service";
import { faqService } from "@/services/faq.service";
import { Errors } from "@/lib/errors";
import { UNCERTAIN_REPLY } from "@/lib/messages";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ReplyInput = {
  context: ContextBundle;
  userQuestion: string;
  userName?: string;
  /** When false, FAQ hits are context only — never short-circuit the agent. */
  preferFaq?: boolean;
};

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

function systemRules() {
  return [
    "You are Sentry, a highly capable AI agent embedded in Telegram as a community employee.",
    "You are not a shallow chatbot: reason carefully, use FAQs + recent chat context, and give useful actionable answers.",
    "Tone: clear, confident, concise (2–6 short sentences unless asked for detail). Never invent policies or facts.",
    "Never claim to be human. Prefer FAQs and group context over speculation.",
    `If uncertain: ${UNCERTAIN_REPLY}`,
  ].join(" ");
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
    .slice(0, 12)
    .map((f, i) => `${i + 1}. Q: ${f.question}\n   A: ${f.answer}`)
    .join("\n");

  return [
    `Group: ${context.groupName}`,
    `Purpose: ${context.purpose ?? "(none)"}`,
    `Description: ${context.description ?? "(none)"}`,
    `Rules: ${context.rules ?? "(none)"}`,
    `FAQs:\n${faqs || "(none)"}`,
    `Recent messages:\n${recent || "(none)"}`,
  ].join("\n\n");
}

function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms);
  });
}

async function callOpenAI(messages: ChatMessage[], maxTokens = 400) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

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
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("OpenAI request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini(messages: ChatMessage[], maxTokens = 400) {
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
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: maxTokens,
          },
        });

        const generatePromise = model
          .generateContent(prompt)
          .then((result: GenerateContentResult) => result.response);
        const response = await Promise.race([
          generatePromise,
          createTimeoutPromise(25_000),
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
async function callLLM(messages: ChatMessage[], maxTokens = 400) {
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

export class AiService {
  async answerFAQ(context: ContextBundle, userQuestion: string) {
    return faqService.match(context.faqs, userQuestion);
  }

  async generateReply(input: ReplyInput) {
    const preferFaq = input.preferFaq !== false;
    const faqHit = faqService.matchDetailed(input.context.faqs, input.userQuestion);
    // Only short-circuit on strong FAQ hits so other employer/member asks still reach the agent.
    if (preferFaq && faqHit && faqHit.score >= 0.72) {
      return { text: faqHit.answer, viaFaq: true as const };
    }

    const text = await callLLM([
      { role: "system", content: systemRules() },
      {
        role: "user",
        content: `${formatContext(input.context)}\n\nUser (${input.userName ?? "member"}) asked:\n${input.userQuestion}\n\nReply in 2-5 short sentences.`,
      },
    ]);
    return { text, viaFaq: false as const };
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
      100,
    );
  }

  async generateDailySummary(context: ContextBundle) {
    return callLLM(
      [
        { role: "system", content: systemRules() },
        {
          role: "user",
          content: `${formatContext(context)}\n\nWrite a daily summary as 5-10 bullet points covering important discussions, questions, decisions, and unanswered questions.`,
        },
      ],
      400,
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
      180,
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
          ].join("\n"),
        },
      ],
      500,
    );
  }
}

export const aiService = new AiService();
