import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { actionService } from "@/services/action.service";

export class PlaybookService {
  async list(userId: string, groupId?: string | null) {
    return prisma.playbookRule.findMany({
      where: {
        userId,
        active: true,
        OR: groupId
          ? [{ groupId }, { groupId: null }]
          : [{ groupId: null }],
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
    });
  }

  async add(input: {
    userId: string;
    groupId?: string | null;
    trigger: string;
    instruction: string;
    source?: "correction" | "manual";
  }) {
    const rule = await prisma.playbookRule.create({
      data: {
        userId: input.userId,
        groupId: input.groupId ?? null,
        trigger: input.trigger.trim().slice(0, 300),
        instruction: input.instruction.trim().slice(0, 1000),
        source: input.source ?? "manual",
      },
    });
    await actionService.record({
      type: "playbook_learn",
      userId: input.userId,
      groupId: input.groupId ?? null,
      billable: true,
      metadata: { ruleId: rule.id, source: rule.source },
    });
    return rule;
  }

  async learnFromCorrection(input: {
    userId: string;
    groupId?: string | null;
    text: string;
  }) {
    const match = input.text.match(/^correct\s*:\s*(.+)$/is);
    if (!match) return null;
    const body = match[1].trim();
    const [triggerPart, ...rest] = body.split("→");
    const instruction = rest.length ? rest.join("→").trim() : body;
    const trigger = rest.length ? triggerPart.trim() : "general correction";
    if (!instruction) return null;
    return this.add({
      userId: input.userId,
      groupId: input.groupId,
      trigger,
      instruction,
      source: "correction",
    });
  }

  async formatForPrompt(userId: string, groupId?: string | null) {
    const rules = await this.list(userId, groupId);
    if (!rules.length) return "";
    return rules
      .slice(0, 12)
      .map((r, i) => `${i + 1}. When "${r.trigger}": ${r.instruction}`)
      .join("\n");
  }

  async remove(userId: string, ruleId: string) {
    await prisma.playbookRule.updateMany({
      where: { id: ruleId, userId },
      data: { active: false },
    });
    return { ok: true };
  }
}

export const playbookService = new PlaybookService();

export class AgentApiKeyService {
  private hash(raw: string) {
    return createHash("sha256").update(raw).digest("hex");
  }

  async create(userId: string, label: string) {
    const raw = `sk_sentry_${randomBytes(24).toString("hex")}`;
    const key = await prisma.agentApiKey.create({
      data: {
        userId,
        label: label.trim().slice(0, 80) || "default",
        keyHash: this.hash(raw),
        keyPrefix: raw.slice(0, 16),
      },
    });
    await prisma.settings.updateMany({
      where: { userId },
      data: { agentApiEnabled: true },
    });
    return { id: key.id, label: key.label, key: raw, prefix: key.keyPrefix };
  }

  async list(userId: string) {
    return prisma.agentApiKey.findMany({
      where: { userId, revokedAt: null },
      select: {
        id: true,
        label: true,
        keyPrefix: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async revoke(userId: string, id: string) {
    await prisma.agentApiKey.updateMany({
      where: { id, userId },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async authenticate(bearer: string | null) {
    if (!bearer?.startsWith("Bearer ")) return null;
    const raw = bearer.slice(7).trim();
    if (!raw.startsWith("sk_sentry_")) return null;
    const key = await prisma.agentApiKey.findUnique({
      where: { keyHash: this.hash(raw) },
      include: {
        user: { include: { settings: true, employment: true, wallet: true } },
      },
    });
    if (!key || key.revokedAt) return null;
    if (!key.user.settings?.agentApiEnabled) return null;
    await prisma.agentApiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });
    return key.user;
  }
}

export const agentApiKeyService = new AgentApiKeyService();
