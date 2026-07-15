import { prisma } from "@/lib/prisma";

const MAX_FAQS = 20;

function normalize(text: string) {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

export class FaqService {
  async list(groupId: string) {
    return prisma.groupFAQ.findMany({
      where: { groupId },
      orderBy: { createdAt: "asc" },
      take: MAX_FAQS,
    });
  }

  async add(groupId: string, question: string, answer: string) {
    const count = await prisma.groupFAQ.count({ where: { groupId } });
    if (count >= MAX_FAQS) {
      throw new Error(`A group can have at most ${MAX_FAQS} FAQs`);
    }
    if (!question.trim() || !answer.trim()) {
      throw new Error("Question and answer are required");
    }

    return prisma.groupFAQ.create({
      data: {
        groupId,
        question: question.trim().slice(0, 500),
        answer: answer.trim().slice(0, 2000),
      },
    });
  }

  async remove(groupId: string, faqId: string) {
    await prisma.groupFAQ.deleteMany({ where: { id: faqId, groupId } });
    return { ok: true };
  }

  /**
   * Simple keyword overlap match — no embeddings.
   */
  match(faqs: Array<{ question: string; answer: string }>, userQuestion: string) {
    const q = normalize(userQuestion);
    if (!q) return null;

    let best: { answer: string; score: number } | null = null;
    for (const faq of faqs) {
      const fq = normalize(faq.question);
      if (!fq) continue;
      if (q.includes(fq) || fq.includes(q)) {
        return faq.answer;
      }
      const qTokens = new Set(q.split(" ").filter((t) => t.length > 2));
      const fTokens = fq.split(" ").filter((t) => t.length > 2);
      if (fTokens.length === 0) continue;
      const hits = fTokens.filter((t) => qTokens.has(t)).length;
      const score = hits / fTokens.length;
      if (score >= 0.6 && (!best || score > best.score)) {
        best = { answer: faq.answer, score };
      }
    }
    return best?.answer ?? null;
  }
}

export const faqService = new FaqService();
