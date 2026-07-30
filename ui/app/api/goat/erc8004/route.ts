import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { goatService } from "@/services/goat.service";

const bodySchema = z.object({
  action: z.enum(["register_agent", "set_agent_uri"]),
  agentUri: z.string().url().optional(),
});

export async function GET() {
  try {
    const user = await requireSessionUser();
    const settings = await prisma.settings.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
    return NextResponse.json({
      config: goatService.getConfig(),
      identity: {
        agentId: settings.goatAgentId,
        agentUri: settings.goatAgentUri,
        registeredAt: settings.goatRegisteredAt,
        registrationTx: settings.goatRegistrationTx,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GOAT status failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const json = await request.json().catch(() => ({}));
    const body = bodySchema.parse(json);
    const settings = await prisma.settings.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });

    if (body.action === "register_agent") {
      const result = await goatService.registerAgent(body.agentUri);
      const updated = await prisma.settings.update({
        where: { userId: user.id },
        data: {
          goatAgentId: result.agentId,
          goatAgentUri: body.agentUri ?? settings.goatAgentUri,
          goatRegisteredAt: new Date(),
          goatRegistrationTx: result.txHash,
        },
      });
      return NextResponse.json({
        message: "GOAT ERC-8004 agent registered.",
        identity: {
          agentId: updated.goatAgentId,
          agentUri: updated.goatAgentUri,
          registeredAt: updated.goatRegisteredAt,
          registrationTx: updated.goatRegistrationTx,
        },
      });
    }

    if (!settings.goatAgentId) {
      return NextResponse.json(
        { error: "No GOAT agent is registered yet. Register agent first." },
        { status: 400 },
      );
    }
    if (!body.agentUri) {
      return NextResponse.json({ error: "agentUri is required for set_agent_uri" }, { status: 400 });
    }

    const result = await goatService.setAgentUri(settings.goatAgentId, body.agentUri);
    const updated = await prisma.settings.update({
      where: { userId: user.id },
      data: {
        goatAgentUri: body.agentUri,
        goatRegistrationTx: result.txHash,
      },
    });
    return NextResponse.json({
      message: "GOAT ERC-8004 agent URI updated.",
      identity: {
        agentId: updated.goatAgentId,
        agentUri: updated.goatAgentUri,
        registeredAt: updated.goatRegisteredAt,
        registrationTx: updated.goatRegistrationTx,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GOAT action failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
