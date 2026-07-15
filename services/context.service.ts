import { prisma } from "@/lib/prisma";

const MAX_CONTEXT = 100;

export type ContextBundle = {
  groupName: string;
  description: string | null;
  rules: string | null;
  recentMessages: Array<{
    from: string;
    text: string;
    at: Date;
  }>;
  faqs: Array<{ question: string; answer: string }>;
  config: {
    enabled: boolean;
    welcomeMembers: boolean;
    replyToMentions: boolean;
    answerQuestions: boolean;
  };
};

export class ContextService {
  async appendMessage(input: {
    groupId: string;
    telegramMessageId: string;
    fromUserId?: string | null;
    fromUsername?: string | null;
    text: string;
  }) {
    if (!input.text.trim()) return;

    await prisma.conversationContext.upsert({
      where: {
        groupId_telegramMessageId: {
          groupId: input.groupId,
          telegramMessageId: input.telegramMessageId,
        },
      },
      create: {
        groupId: input.groupId,
        telegramMessageId: input.telegramMessageId,
        fromUserId: input.fromUserId ?? null,
        fromUsername: input.fromUsername ?? null,
        text: input.text.slice(0, 4000),
      },
      update: {
        text: input.text.slice(0, 4000),
        fromUserId: input.fromUserId ?? null,
        fromUsername: input.fromUsername ?? null,
      },
    });

    const excess = await prisma.conversationContext.findMany({
      where: { groupId: input.groupId },
      orderBy: { createdAt: "desc" },
      skip: MAX_CONTEXT,
      select: { id: true },
    });

    if (excess.length > 0) {
      await prisma.conversationContext.deleteMany({
        where: { id: { in: excess.map((row) => row.id) } },
      });
    }
  }

  async build(groupId: string): Promise<ContextBundle> {
    const group = await prisma.telegramGroup.findUnique({
      where: { id: groupId },
      include: {
        settings: true,
        faqs: { orderBy: { createdAt: "asc" }, take: 20 },
        messages: { orderBy: { createdAt: "desc" }, take: MAX_CONTEXT },
      },
    });

    if (!group) {
      throw new Error("Group not found");
    }

    const recent = [...group.messages].reverse();

    return {
      groupName: group.name ?? `Group ${group.telegramId}`,
      description: group.description,
      rules: group.rules,
      recentMessages: recent.map((m) => ({
        from: m.fromUsername ?? m.fromUserId ?? "member",
        text: m.text,
        at: m.createdAt,
      })),
      faqs: group.faqs.map((f) => ({ question: f.question, answer: f.answer })),
      config: {
        enabled: group.settings?.enabled ?? false,
        welcomeMembers: group.settings?.welcomeMembers ?? true,
        replyToMentions: group.settings?.replyToMentions ?? true,
        answerQuestions: group.settings?.answerQuestions ?? true,
      },
    };
  }
}

export const contextService = new ContextService();
