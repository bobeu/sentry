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
    "Only answer using the provided group context, FAQs, and recent messages.",
    "If you are unsure, say exactly: I don't know.",
    "Keep replies concise and helpful.",
  ].join(" ");
}

function formatContext(context: ContextBundle) {
  const recent = context.recentMessages
    .slice(-30)
    .map((m) => `${m.from}: ${m.text}`)
    .join("\n");
  const faqs = context.faqs
    .map((f, i) => `${i + 1}. Q: ${f.question}\n   A: ${f.answer}`)
    .join("\n");

  return [
    `Group: ${context.groupName}`,
    `Description: ${context.description ?? "(none)"}`,
    `Rules: ${context.rules ?? "(none)"}`,
    `FAQs:\n${faqs || "(none)"}`,
    `Recent messages:\n${recent || "(none)"}`,
  ].join("\n\n");
}

async function callOpenAI(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
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
  const content = data.choices?.[0]?.message?.content?.trim();
  return content || "I don't know.";
}

export class AiService {
  async answerFAQ(context: ContextBundle, userQuestion: string) {
    return faqService.match(context.faqs, userQuestion);
  }

  async generateReply(input: ReplyInput) {
    const faqHit = await this.answerFAQ(input.context, input.userQuestion);
    if (faqHit) return faqHit;

    return callOpenAI([
      { role: "system", content: systemRules() },
      {
        role: "user",
        content: `${formatContext(input.context)}\n\nUser (${input.userName ?? "member"}) asked:\n${input.userQuestion}`,
      },
    ]);
  }

  async generateWelcome(input: {
    context: ContextBundle;
    memberName: string;
  }) {
    return callOpenAI([
      { role: "system", content: systemRules() },
      {
        role: "user",
        content: `${formatContext(input.context)}\n\nWrite a short friendly welcome for new member "${input.memberName}". Max 2 sentences.`,
      },
    ]);
  }

  /** Kept for later prompts — not used in Prompt 3. */
  summarize(): never {
    throw new Error("Not Implemented");
  }

  moderate(): never {
    throw new Error("Not Implemented");
  }
}

export const aiService = new AiService();
