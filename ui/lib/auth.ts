import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isNonEmptyString } from "@/lib/helpers";
import { randomBytes } from "crypto";

const SESSION_COOKIE = "sentry_session";
const SESSION_DAYS = 14;

export async function loginWithEmail(email: string) {
  if (!isNonEmptyString(email)) {
    throw new Error("Email is required");
  }

  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.upsert({
    where: { email: normalized },
    update: {},
    create: {
      email: normalized,
      settings: {
        create: {},
      },
    },
  });

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      token,
      userId: user.id,
      expiresAt,
    },
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
    },
  };
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    return null;
  }

  return session.user;
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireSessionUser();
  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0 || !allow.includes(user.email.toLowerCase())) {
    const { Errors } = await import("@/lib/errors");
    throw Errors.forbidden();
  }
  return user;
}

export { SESSION_COOKIE };
