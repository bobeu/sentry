import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isGrandAdminUser } from "@/lib/owner";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  const isGrandAdmin = await isGrandAdminUser(user.id);
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      withdrawalAddress: user.withdrawalAddress,
      pendingWithdrawalAddress: user.pendingWithdrawalAddress,
      isGrandAdmin,
    },
  });
}
