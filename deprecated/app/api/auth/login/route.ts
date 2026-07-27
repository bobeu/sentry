import { NextResponse } from "next/server";
import { loginWithEmail, setSessionCookie } from "@/lib/auth";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().email(),
  walletAddress: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { email, walletAddress } = bodySchema.parse(json);
    const session = await loginWithEmail(email, { walletAddress });
    await setSessionCookie(session.token);
    return NextResponse.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
