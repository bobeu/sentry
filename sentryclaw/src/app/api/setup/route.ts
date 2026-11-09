import { isVercelDeployment } from "@/server/env";
import { logInfo } from "@/server/log";
import { getConfiguredAdminSecret } from "@/server/auth/admin-secret";
import { jsonError } from "@/shared/http";

/**
 * GET /api/setup
 *
 * On Vercel deployments this endpoint is sealed — it returns 410 Gone.
 * Operators must set ADMIN_SECRET as an environment variable instead of
 * relying on a first-caller-wins bootstrap flow.
 *
 * In local/non-Vercel environments it returns a status hint (never the
 * actual secret) so `npm run dev` still works with auto-generated secrets.
 */
export async function GET(_request: Request): Promise<Response> {
  try {
    if (isVercelDeployment()) {
      logInfo("setup.sealed", {
        reason: "endpoint_disabled_on_vercel",
        guidance: "set ADMIN_SECRET env var",
      });
      return Response.json(
        {
          error: "SETUP_ENDPOINT_SEALED",
          message:
            "This endpoint is disabled on deployed environments. " +
            "Set the ADMIN_SECRET environment variable in your Vercel project settings.",
        },
        { status: 410 },
      );
    }

    // Local dev: report whether an admin secret is available without
    // revealing the actual value.
    const configured = await getConfiguredAdminSecret();
    if (!configured) {
      return Response.json(
        {
          error: "ADMIN_SECRET_UNAVAILABLE",
          message: "Admin secret is not configured.",
        },
        { status: 503 },
      );
    }

    if (configured.source === "env") {
      logInfo("setup.local_status", { source: "env" });
      return Response.json({
        source: "env",
        message: "ADMIN_SECRET is set via environment variable. Use it to log in.",
      });
    }

    // Auto-generated secret in local dev — reveal it since there is no
    // other way to discover it locally.
    logInfo("setup.local_status", { source: "generated" });
    return Response.json({
      source: "generated",
      secret: configured.secret,
      message:
        "Auto-generated admin secret for local development. " +
        "On deployed environments, set ADMIN_SECRET as an env var instead.",
    });
  } catch (error) {
    return jsonError(error);
  }
}
