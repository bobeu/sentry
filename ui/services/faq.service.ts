import { prisma } from "@/lib/prisma";

const MAX_FAQS = 20;

function normalize(text: string) {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

export type FaqMatch = { answer: string; score: number; question: string };

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
   * Lexical FAQ match with score. High scores (≥0.72) are safe auto-answers;
   * weaker hits should be passed to the LLM as context instead.
   */
  matchDetailed(
    faqs: Array<{ question: string; answer: string }>,
    userQuestion: string,
  ): FaqMatch | null {
    const q = normalize(userQuestion);
    if (!q) return null;

    let best: FaqMatch | null = null;
    const qTokens = q.split(" ").filter((t) => t.length > 2);
    const qTokenSet = new Set(qTokens);

    for (const faq of faqs) {
      const fq = normalize(faq.question);
      if (!fq) continue;

      if (q === fq || q.includes(fq) || fq.includes(q)) {
        return { answer: faq.answer, score: 1, question: faq.question };
      }

      const fTokens = fq.split(" ").filter((t) => t.length > 2);
      if (fTokens.length === 0) continue;
      const hits = fTokens.filter((t) => qTokenSet.has(t)).length;
      let score = hits / fTokens.length;

      const distinctive = fTokens.filter((t) => t.length >= 5);
      const distinctiveHits = distinctive.filter((t) => qTokenSet.has(t)).length;
      if (distinctive.length > 0 && distinctiveHits === distinctive.length) {
        // Single shared noun (e.g. "flowsight") is not enough when the user asked something else.
        const extraIntent = qTokens.filter((t) => !fTokens.includes(t) && t.length > 3);
        if (extraIntent.length <= 1) {
          score = Math.max(score, 0.85);
        } else {
          score = Math.max(score, 0.55);
        }
      }

      if (score >= 0.45 && (!best || score > best.score)) {
        best = { answer: faq.answer, score, question: faq.question };
      }
    }
    return best;
  }

  match(faqs: Array<{ question: string; answer: string }>, userQuestion: string) {
    const hit = this.matchDetailed(faqs, userQuestion);
    if (!hit || hit.score < 0.72) return null;
    return hit.answer;
  }
}

export const faqService = new FaqService();
