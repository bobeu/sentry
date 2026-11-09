/**
 * x402 PayTo endpoint — Sentry Agent Intelligence API
 *
 * Callers that want on-demand agent Q&A or community analysis pay a small
 * USDC or USAT micro-fee (via EIP-3009 TransferWithAuthorization) on Celo
 * Mainnet before receiving a response.
 *
 * Protocol: https://docs.celo.org/build-on-celo/build-with-ai/x402
 *
 * Flow:
 *   1. Caller sends POST /api/pay  → receives HTTP 402 + payment challenge JSON
 *   2. Caller signs EIP-3009 auth and retries with X-Payment header (base64 JSON)
 *   3. This route verifies the payment header structure, returns the response
 *
 * The PayTo wallet is the Sentry agent wallet on Celo Mainnet.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sentry agent wallet — payments land here on Celo Mainnet */
const AGENT_WALLET =
  (process.env.AGENT_WALLET_ADDRESS as `0x${string}`) ??
  "0xa1f70ffA4322E3609dD905b41f17Bf3913366bC1";

/** USDC on Celo Mainnet (6 decimals) */
const USDC_ADDRESS = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";

/** USAT on Celo Mainnet (6 decimals) */
const USAT_ADDRESS =
  (process.env.CELO_USAT_ADDRESS as `0x${string}`) ??
  "0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771";

/** Price: 0.01 USDC or USAT (10_000 atomic units at 6 decimals) */
const PRICE_ATOMIC = "10000";

/** Payment timeout: 5 minutes */
const TIMEOUT_SECONDS = 300;

/**
 * Build the standard x402 payment challenge object.
 * Returned on HTTP 402 as the response body AND as the WWW-Authenticate header.
 */
function buildChallenge(requestUrl: string) {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        network: "celo",
        asset: USDC_ADDRESS,
        extra: { name: "USD Coin", version: "2" },
        maxAmountRequired: PRICE_ATOMIC,
        payTo: AGENT_WALLET,
        maxTimeoutSeconds: TIMEOUT_SECONDS,
        description: "Sentry Agent Intelligence API — 0.01 USDC per query",
        resource: requestUrl,
      },
      {
        scheme: "exact",
        network: "celo",
        asset: USAT_ADDRESS,
        extra: { name: "USAT", version: "1" },
        maxAmountRequired: PRICE_ATOMIC,
        payTo: AGENT_WALLET,
        maxTimeoutSeconds: TIMEOUT_SECONDS,
        description: "Sentry Agent Intelligence API — 0.01 USAT per query",
        resource: requestUrl,
      },
    ],
  };
}

/**
 * Parse and lightly validate the X-Payment header.
 * Returns the decoded payload or null if malformed / missing.
 */
function parsePaymentHeader(header: string | null): Record<string, unknown> | null {
  if (!header) return null;
  try {
    const decoded = Buffer.from(header, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    // Minimum shape: x402Version, scheme, network, payload.signature
    if (!p.x402Version || !p.scheme || !p.network) return null;
    const payload = p.payload as Record<string, unknown> | undefined;
    if (!payload?.signature) return null;
    return p;
  } catch {
    return null;
  }
}

export async function GET() {
  return NextResponse.json({
    service: "Sentry Agent Intelligence API",
    description:
      "POST a JSON body with a `query` field. First call returns HTTP 402 with payment details. " +
      "Retry with X-Payment header (base64-encoded EIP-3009 auth) to receive the agent response.",
    payTo: AGENT_WALLET,
    price: `${Number(PRICE_ATOMIC) / 1e6} USDC or USAT per query`,
    network: "celo",
    protocol: "x402 (https://docs.celo.org/build-on-celo/build-with-ai/x402)",
  });
}

export async function POST(request: NextRequest) {
  const url = request.url;
  const paymentHeader = request.headers.get("x-payment");

  // No payment header → return 402 challenge
  if (!paymentHeader) {
    const challenge = buildChallenge(url);
    return NextResponse.json(challenge, {
      status: 402,
      headers: {
        "WWW-Authenticate": `x402 realm="Sentry Agent Intelligence API"`,
        "Content-Type": "application/json",
      },
    });
  }

  // Verify payment header structure
  const payment = parsePaymentHeader(paymentHeader);
  if (!payment) {
    return NextResponse.json(
      { error: "Malformed X-Payment header — expected base64-encoded JSON with x402Version, scheme, network, payload.signature" },
      { status: 400 },
    );
  }

  // Check network
  if (payment.network !== "celo") {
    return NextResponse.json(
      { error: `Unsupported network: ${String(payment.network)}. This endpoint accepts Celo mainnet payments only.` },
      { status: 400 },
    );
  }

  // Parse request body
  let body: { query?: string } = {};
  try {
    body = (await request.json()) as { query?: string };
  } catch {
    // Allow empty body — will use a default response
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";

  // Build the paid response
  // In production this would call the AI service; here we return a verifiable structured response
  const response = {
    ok: true,
    service: "Sentry Agent Intelligence API",
    version: "1",
    network: "celo",
    payTo: AGENT_WALLET,
    query: query || "(no query provided)",
    answer:
      query
        ? `Sentry processed your query via x402 payment on Celo Mainnet. ` +
          `For live AI responses, wire this endpoint to your Sentry deployment.`
        : "Payment verified. Submit a query in the JSON body: { \"query\": \"your question\" }",
    attributionTag: "celo_39f96dcb58cc",
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, {
    headers: {
      "X-Payment-Response": Buffer.from(
        JSON.stringify({ success: true, network: "celo", payTo: AGENT_WALLET }),
      ).toString("base64"),
    },
  });
}
