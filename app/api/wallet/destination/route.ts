import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { walletService } from "@/services/wallet.service";

const schema = z.object({
  withdrawalAddress: z.string().min(1),
});

export async function GET() {
  try {
    const user = await requireSessionUser();
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { withdrawalAddress: true },
    });
    return NextResponse.json({
      withdrawalAddress: row?.withdrawalAddress ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Destination failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 400 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireSessionUser();
    const { withdrawalAddress } = schema.parse(await request.json());
    return NextResponse.json(
      await walletService.setWithdrawalAddress(user.id, withdrawalAddress),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Destination update failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 400 },
    );
  }
}
