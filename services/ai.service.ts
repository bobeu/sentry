import type { ContextBundle } from "@/services/context.service";
import { faqService } from "@/services/faq.service";
import { Errors } from "@/lib/errors";

type ReplyInput = {
  context: ContextBundle;
  userQuestion: string;
  userName?: string;
};

const UNCERTAIN = "I don't know based on the available context.";

function systemRules() {
  return [
    "You are Sentry, an AI community employee for Telegram.",
    "Give short responses only.",
    "Never fabricate information.",
    "Never invent group rules, policies, or facts.",
    "Always respect the provided group rules when answering.",
    "Never pretend to be human.",
    "Only use provided group context, FAQs, and recent messages.",
    "Never answer outside the available context.",
    `If uncertain, say exactly: ${UNCERTAIN}`,
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

async function callOpenAI(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  maxTokens = 400,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw Errors.aiUnavailable();
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
      throw Errors.aiUnavailable();
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || UNCERTAIN;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw Errors.aiUnavailable();
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export class AiService {
  async answerFAQ(context: ContextBundle, userQuestion: string) {
    return faqService.match(context.faqs, userQuestion);
  }

  async generateReply(input: ReplyInput) {
    const faqHit = await this.answerFAQ(input.context, input.userQuestion);
    if (faqHit) return { text: faqHit, viaFaq: true as const };

    const text = await callOpenAI([
      { role: "system", content: systemRules() },
      {
        role: "user",
        content: `${formatContext(input.context)}\n\nUser (${input.userName ?? "member"}) asked:\n${input.userQuestion}\n\nReply in 2-5 short sentences.`,
      },
    ]);
    return { text, viaFaq: false as const };
  }

  async generateWelcome(input: { context: ContextBundle; memberName: string }) {
    return callOpenAI(
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
    return callOpenAI(
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
    return callOpenAI(
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

  summarize(): never {
    throw new Error("Not Implemented");
  }

  moderate(): never {
    throw new Error("Not Implemented");
  }
}

export const aiService = new AiService();
