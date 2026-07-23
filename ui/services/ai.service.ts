import {
  GoogleGenerativeAI,
  type GenerateContentResult,
} from "@google/generative-ai";
import type { ContextBundle } from "@/services/context.service";
import { faqService } from "@/services/faq.service";
import { knowledgeService } from "@/services/knowledge.service";
import { Errors } from "@/lib/errors";
import { UNCERTAIN_REPLY } from "@/lib/messages";
import {
  formatCeloKnowledgeForPrompt,
  looksCeloRelated,
} from "@/lib/celo-knowledge";

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
  engagementContext?: string | null;
  humorEnabled?: boolean | null;
  humorStyle?: string | null;
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
  includeCelo?: boolean;
  engagementContext?: string | null;
  humorEnabled?: boolean | null;
  humorStyle?: string | null;
}) {
  const humorOn = extras?.humorEnabled !== false && extras?.humorStyle !== "off";
  const humorStyle = (extras?.humorStyle ?? "friendly").toLowerCase();
  const parts = [
    "You are Sentry, a highly capable AI agent embedded in Telegram as a community employee — and a friendly teammate.",
    "You are not a shallow chatbot: reason carefully, use FAQs, knowledge-base tool results, and recent chat context.",
    "Tone: talk like a sharp, warm friend — clear and lively, never stiff or corporate. Prefer short paragraphs over walls of text.",
    "Always finish your answer — never stop mid-sentence or mid-list. If space is tight, prioritize completeness over fluff.",
    "CRITICAL — no hallucination: Never invent policies, prices, balances, tx hashes, links, or facts. Prefer FAQs/KB excerpts. If unknown, say so.",
    "CRITICAL — answer only what was asked. Do not dump unrelated FAQs, prior answers, or capability lists unless asked.",
    "CRITICAL — if the member only greets (hi/hello) or only says thanks, keep it to 1–2 short friendly sentences. Do NOT re-answer previous questions.",
    "CRITICAL — recent chat is context only. Do not restate prior Q&A unless the member asks you to repeat or clarify.",
    "CRITICAL — NEVER pretend you created a poll/quiz/activity in chat. The runtime creates activities. If asked when a poll ends or what's active, answer from engagement context / say you don't see one — do NOT invent a new poll.",
    "CRITICAL — questions about polls (end time, status, points, rules) are answers, not create-commands.",
    "Never claim to be human.",
    "You can moderate spam (warn/delete/mute/ban when admin), answer community questions, and (when enabled) run light fun/polls/games/learn activities.",
    "When engagement is enabled and the vibe fits, you may briefly offer a poll, trivia, or learn-and-earn — never force it into serious support questions.",
    "Authorized operator AskBot checks are handled by the runtime (skill .agents/askbot/SKILL.md) — do not invent AskBot API results.",
    "Formatting for Telegram: use **bold** for emphasis, short paragraphs, and • bullets. Do NOT sprinkle decorative asterisks. Do not use Markdown tables or headings with #.",
    `If uncertain after using available context/tools: ${UNCERTAIN_REPLY}`,
  ];
  if (humorOn) {
    parts.push(
      `Humor mode ON (style: ${humorStyle}). Sprinkle light jokes, playful asides, or wholesome comedy when it fits — never at someone's expense, never during moderation/safety/billing crises.`,
    );
  } else {
    parts.push("Humor mode OFF — stay friendly but skip jokes.");
  }
  if (extras?.includeCelo) {
    parts.push(formatCeloKnowledgeForPrompt());
  }
  if (extras?.personaRole && extras.personaRole !== "default") {
    parts.push(
      `Persona role for this group: ${extras.personaRole}.` +
        (extras.personaTone ? ` Tone guidance: ${extras.personaTone}.` : ""),
    );
  } else if (extras?.personaTone) {
    parts.push(`Tone guidance: ${extras.personaTone}.`);
  }
  if (extras?.playbookRules) {
    parts.push(`Employer playbook rules (must follow):\n${extras.playbookRules}`);
  }
  if (extras?.memberNote) {
    parts.push(`Consented member memory note: ${extras.memberNote}`);
  }
  if (extras?.engagementContext) {
    parts.push(`Engagement / rewards settings for this group:\n${extras.engagementContext}`);
  }
  return parts.join("\n");
}

function employerSystemRules() {
  return [
    systemRules({ includeCelo: true }),
    "This is a private DM with the employer who hired you.",
    "You work as their employee across enabled Telegram groups: moderate spam, answer FAQs/KB, welcome members, send reports.",
    "You CAN remove spam and track moderation — never claim you cannot.",
    "Explain past work, group status, wallet/funding, and employment agreement using operational data when provided.",
    "When operational data is provided below, ground your answer in it. Do not invent metrics.",
  ].join("\n");
}

function formatContext(context: ContextBundle) {
  const recent = context.recentMessages
    .slice(-15)
    .map((m) => `${m.from}: ${m.text}`)
    .join("\n");
  // Titles only — full answers come from tool results to reduce FAQ dumping / hallucination.
  const faqs = context.faqs
    .slice(0, 12)
    .map((f, i) => `${i + 1}. ${f.question}`)
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
    `FAQ topics (use tool results for answers — do not invent):\n${faqs || "(none)"}`,
    `Knowledge sources:\n${kb || "(none)"}`,
    `Recent messages (context only — do not re-answer unless asked):\n${recent || "(none)"}`,
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
      humorEnabled: input.humorEnabled,
      humorStyle: input.humorStyle,
      includeCelo: looksCeloRelated(input.userQuestion),
      engagementContext: input.engagementContext,
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
            looksCeloRelated(input.userQuestion)
              ? `\nCelo ecosystem references (link official sources; do not invent addresses):\n${formatCeloKnowledgeForPrompt()}`
              : "",
            "",
            `User (${input.userName ?? "member"}) asked:`,
            input.userQuestion,
            "",
            "Write a complete, helpful reply grounded in the tool results and group context.",
            "Answer ONLY this ask. Do not dump FAQ lists, prior answers, or capability walls.",
            "If tool results fully answer the question, prefer them. If not, say what is known and what is not.",
          ]
            .filter(Boolean)
            .join("\n"),
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
    const rules = input.context.rules?.trim();
    const purpose = input.context.purpose?.trim();
    const description = input.context.description?.trim();
    return callLLM(
      [
        {
          role: "system",
          content: [
            systemRules(),
            "Welcome new members warmly and clearly. Include what this group is for and the house rules when provided.",
            "Structure: greeting → purpose → key rules (short bullets) → how to get help (mention Sentry).",
            "Use **bold** sparingly for labels. No decorative asterisks.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `Member to welcome: ${input.memberName}`,
            `Group: ${input.context.groupName}`,
            purpose ? `Purpose: ${purpose}` : "Purpose: (not set)",
            description ? `Description: ${description}` : "",
            rules ? `Rules:\n${rules}` : "Rules: (not set — invite them to ask before posting off-topic)",
            "",
            "Write a complete welcome (about 4–8 short sentences / bullets). Finish completely.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      600,
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

  /**
   * Draft a poll / trivia / fun activity as strict JSON for Telegram posting.
   */
  async generateEngagementActivity(input: {
    type: "poll" | "game" | "learn" | "social" | "comic" | "fun";
    context: ContextBundle;
    guidelines?: string | null;
    hint?: string | null;
  }): Promise<{
    title: string;
    description: string;
    config: Record<string, unknown>;
  }> {
    const raw = await callLLM(
      [
        {
          role: "system",
          content: [
            "You invent short, lively community engagement activities for Telegram.",
            "Return ONLY valid JSON (no markdown fences) with keys: title, description, config.",
            "config.format must be one of: single | multiple | quiz | open.",
            "single: one-choice poll (options required). multiple: multi-select poll (options required). quiz: Telegram quiz with correctIndex (0-based) + explanation. open: no options — put acceptedAnswers: string[] for free-text grading.",
            "For learn/game prefer format=quiz unless the hint asks for open/multiple.",
            "For poll prefer format=single unless hint says multiple.",
            "For fun/comic: vibe check with options OR open joke punchline with acceptedAnswers.",
            "Keep questions under 280 chars. Options under 80 chars each.",
            "Stay on-brand for the group's purpose; never invent fake company policies as quiz facts.",
            "Be playful, funny, wholesome — no harassment, politics bait, or adult content.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `Activity type: ${input.type}`,
            `Group: ${input.context.groupName}`,
            `Purpose: ${input.context.purpose ?? "(none)"}`,
            input.guidelines?.trim()
              ? `Employer guidelines:\n${input.guidelines.trim()}`
              : "",
            input.hint?.trim() ? `Extra hint: ${input.hint.trim()}` : "",
            "Invent one fun activity now as JSON.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      700,
    );

    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const parsed = JSON.parse(cleaned) as {
        title?: string;
        description?: string;
        config?: Record<string, unknown>;
      };
      const title = (parsed.title ?? `${input.type} time`).slice(0, 120);
      const description = (parsed.description ?? "Join in!").slice(0, 500);
      const config = parsed.config ?? {
        question: title,
        options: ["A", "B", "C", "D"],
        correctIndex: 0,
      };
      return { title, description, config };
    } catch {
      return {
        title: input.type === "poll" ? "Quick pulse check" : "Trivia time",
        description: "Tap an option — winners earn points!",
        config: {
          question:
            input.type === "poll"
              ? "How's the vibe in this group today?"
              : "Which chain is Celo built for?",
          options:
            input.type === "poll"
              ? ["Great", "Okay", "Needs energy", "Surprise me"]
              : ["Mobile-first payments", "Only NFTs", "Gaming only", "Private intranet"],
          correctIndex: input.type === "poll" ? undefined : 0,
          explanation:
            input.type === "poll"
              ? undefined
              : "Celo focuses on mobile-first, accessible payments and DeFi.",
        },
      };
    }
  }
}

export const aiService = new AiService();
