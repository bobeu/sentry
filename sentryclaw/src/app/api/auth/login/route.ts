import { loginWithAdminSecret } from "@/server/auth/admin-auth";
import { checkRateLimit, getCallerKey } from "@/server/auth/rate-limit";
import { isSecureRequest } from "@/server/auth/session";
import { logInfo, logWarn } from "@/server/log";
import { jsonError } from "@/shared/http";

export async function POST(request: Request): Promise<Response> {
  try {
    const callerKey = getCallerKey(request);
    const limit = checkRateLimit(callerKey);
    if (!limit.allowed) {
      logWarn("auth.login_rate_limited", { callerKey });
      return Response.json(
        {
          error: "RATE_LIMITED",
          message: "Too many login attempts. Try again later.",
          retryAfterMs: limit.retryAfterMs,
        },
        {
          status: 429,
          headers: limit.retryAfterMs
            ? { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) }
            : {},
        },
      );
    }

    const body = (await request.json()) as { secret?: unknown };
    if (typeof body.secret !== "string" || body.secret.trim().length === 0) {
      return Response.json(
        { error: "INVALID_SECRET", message: "Secret must be a non-empty string." },
        { status: 400 },
      );
    }

    const result = await loginWithAdminSecret(
      body.secret.trim(),
      isSecureRequest(request),
    );

    if (!result) {
      logWarn("auth.login_failed", { callerKey });
      return Response.json(
        { error: "UNAUTHORIZED", message: "Invalid admin secret." },
        { status: 401 },
      );
    }

    logInfo("auth.login_success", { callerKey });
    const response = Response.json({ ok: true });
    response.headers.append("Set-Cookie", result.setCookieHeader);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
