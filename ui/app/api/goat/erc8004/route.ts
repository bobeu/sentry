import { NextResponse } from "next/server";

// GOAT integration removed — ERC-8004 registration is handled via the Aigora
// marketplace at https://aigora.org (agent ID 9680 on Celo Sepolia).
export async function GET() {
  return NextResponse.json({ error: "GOAT integration removed" }, { status: 410 });
}
export async function POST() {
  return NextResponse.json({ error: "GOAT integration removed" }, { status: 410 });
}
