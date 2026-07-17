import { NextResponse } from "next/server";
import { getBot } from "@/services/telegram.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const bot = getBot();
  const update = await request.json();
  await bot.handleUpdate(update);
  return NextResponse.json({ ok: true });
}
