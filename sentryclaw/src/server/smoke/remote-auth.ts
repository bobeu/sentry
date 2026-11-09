/**
 * Auth helper for the remote smoke runner.
 *
 * - In `sign-in-with-vercel` mode: reads SMOKE_AUTH_COOKIE from env
 *   (or accepts a CLI override) and attaches it as a Cookie header.
 * - In `admin-secret` mode: reads SMOKE_ADMIN_SECRET or ADMIN_SECRET from env
 *   (or accepts a CLI override) and attaches it as a bearer token.
 * - If the deployment also has Vercel deployment protection, reads
 *   VERCEL_AUTOMATION_BYPASS_SECRET from env (or accepts a CLI override via
 *   --protection-bypass) and sends the `x-vercel-protection-bypass` header.
 */

/** Module-level cookie override set by the CLI via `setAuthCookie()`. */
let _cookieOverride: string | undefined;

/** Module-level bypass secret override set by the CLI via `setProtectionBypass()`. */
let _bypassOverride: string | undefined;

/** Module-level admin secret override set by the CLI via `setAdminSecret()`. */
let _adminSecretOverride: string | undefined;

/**
 * Set an explicit auth cookie value. Takes precedence over SMOKE_AUTH_COOKIE env var.
 * Used by the CLI when `--auth-cookie` is supplied.
 * Pass `undefined` to clear a previously set override.
 */
export function setAuthCookie(value: string | undefined): void {
  _cookieOverride = value;
}

/**
 * Set an explicit protection bypass secret. Takes precedence over
 * VERCEL_AUTOMATION_BYPASS_SECRET env var.
 * Used by the CLI when `--protection-bypass` is supplied.
 */
export function setProtectionBypass(value: string | undefined): void {
  _bypassOverride = value;
}

/**
 * Set an explicit admin secret. Takes precedence over SMOKE_ADMIN_SECRET and
 * ADMIN_SECRET env vars. Used by the CLI when `--admin-secret` is supplied.
 */
export function setAdminSecret(value: string | undefined): void {
  _adminSecretOverride = value;
}

/**
 * Return which auth source is active, for diagnostics.
 */
export function getAuthSource(): string {
  const parts: string[] = [];
  if (_bypassOverride || process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    parts.push("edge-bypass");
  }
  if (_adminSecretOverride || process.env.SMOKE_ADMIN_SECRET || process.env.ADMIN_SECRET) {
    parts.push("admin-secret");
  }
  if (_cookieOverride || process.env.SMOKE_AUTH_COOKIE) {
    parts.push("cookie");
  }
  return parts.length ? parts.join("+") : "none";
}

/**
 * Build headers for an authenticated request.
 * GET/HEAD requests only need the cookie/bypass (if any).
 * Mutation requests (POST/PUT/DELETE) also need the CSRF header.
 */
export function authHeaders(
  opts: { mutation?: boolean } = {},
): Record<string, string> {
  const headers: Record<string, string> = {};

  const cookie = _cookieOverride ?? process.env.SMOKE_AUTH_COOKIE;
  if (cookie) {
    headers.Cookie = cookie;
  }

  const bypass = _bypassOverride ?? process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass) {
    headers["x-vercel-protection-bypass"] = bypass;
  }

  const adminSecret = _adminSecretOverride ?? process.env.SMOKE_ADMIN_SECRET ?? process.env.ADMIN_SECRET;
  if (adminSecret) {
    headers.Authorization = `Bearer ${adminSecret}`;
  }

  if (opts.mutation) {
    headers["X-Requested-With"] = "XMLHttpRequest";
  }

  return headers;
}
