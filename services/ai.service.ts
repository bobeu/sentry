import type { ContextBundle } from "@/services/context.service";
import { faqService } from "@/services/faq.service";

type ReplyInput = {
  context: ContextBundle;
  userQuestion: string;
  userName?: string;
};

function systemRules() {
  return [
    "You are Sentry, an AI community employee for Telegram.",
    "Never invent group rules.",
    "Never pretend to be human.",
    "Only use provided group context, FAQs, and recent messages.",
    "If unsure, say exactly: I don't know.",
    "Keep replies concise.",
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
    throw new Error("OPENAI_API_KEY is not configured");
  }

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
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() || "I don't know.";
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
        content: `${formatContext(input.context)}\n\nUser (${input.userName ?? "member"}) asked:\n${input.userQuestion}`,
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
          content: `${formatContext(input.context)}\n\nWrite a short friendly welcome for "${input.memberName}". Max 2 sentences.`,
        },
      ],
      120,
    );
  }

  async generateDailySummary(context: ContextBundle) {
    return callOpenAI(
      [
        { role: "system", content: systemRules() },
        {
          role: "user",
          content: `${formatContext(context)}\n\nWrite a concise daily summary with sections:\n- Important discussions\n- Questions asked\n- Decisions made\n- Unanswered questions\nKeep under 180 words.`,
        },
      ],
      350,
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
          content: `${formatContext(input.context)}\n\n@${input.mentionedUsername} was mentioned:\n"${input.triggerText}"\n\nWrite a private notification with:\nSummary:\n...\nRecommended action:\n...\nKeep under 100 words.`,
        },
      ],
      220,
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
