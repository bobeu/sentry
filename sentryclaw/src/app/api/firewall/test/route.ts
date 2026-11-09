import { requireJsonRouteAuth, authJsonOk } from "@/server/auth/route-auth";
import { normalizeDomain } from "@/server/firewall/domains";
import { getFirewallState } from "@/server/firewall/state";
import { ApiError, jsonError } from "@/shared/http";

export async function POST(request: Request): Promise<Response> {
  const auth = await requireJsonRouteAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  let body: { domain?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return jsonError(new ApiError(400, "INVALID_JSON", "Request body must be valid JSON."));
  }

  if (typeof body.domain !== "string" || body.domain.trim().length === 0) {
    return jsonError(new ApiError(400, "MISSING_DOMAIN", "Missing or empty 'domain' field."));
  }

  const normalizedDomain = normalizeDomain(body.domain);
  if (!normalizedDomain) {
    return jsonError(
      new ApiError(400, "INVALID_DOMAIN", "Domain must be a valid hostname or URL."),
    );
  }
  const firewall = await getFirewallState();

  let allowed: boolean;
  let reason: string;

  switch (firewall.mode) {
    case "disabled":
      allowed = true;
      reason = "Firewall is disabled — all traffic is allowed.";
      break;
    case "learning":
      allowed = true;
      reason = "Firewall is in learning mode — all traffic is allowed.";
      break;
    case "enforcing": {
      const inAllowlist = firewall.allowlist.includes(normalizedDomain);
      allowed = inAllowlist;
      reason = inAllowlist
        ? `Domain "${normalizedDomain}" is in the allowlist.`
        : `Domain "${normalizedDomain}" is not in the allowlist — traffic would be blocked.`;
      break;
    }
  }

  return authJsonOk(
    { allowed, reason, domain: normalizedDomain, normalizedDomain, mode: firewall.mode },
    auth,
  );
}
