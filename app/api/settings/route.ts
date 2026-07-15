import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  displayName: z.string().max(80).optional(),
  timeZone: z.string().min(1).max(64).optional(),
  autoResume: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
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
      settings: {
        displayName: settings.displayName ?? "",
        timeZone: settings.timeZone,
        autoResume: settings.autoResume,
        emailNotifications: settings.emailNotifications,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Settings failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireSessionUser();
    const json = await request.json();
    const data = updateSchema.parse(json);

    const settings = await prisma.settings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        displayName: data.displayName,
        timeZone: data.timeZone ?? "UTC",
        autoResume: data.autoResume ?? true,
        emailNotifications: data.emailNotifications ?? true,
      },
      update: data,
    });

    return NextResponse.json({
      settings: {
        displayName: settings.displayName ?? "",
        timeZone: settings.timeZone,
        autoResume: settings.autoResume,
        emailNotifications: settings.emailNotifications,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Settings failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
