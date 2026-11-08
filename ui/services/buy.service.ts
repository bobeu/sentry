import {
  createWalletClient,
  createPublicClient,
  http,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { CELO_ATTRIBUTION_TAG, CELO_ATTRIBUTION_SUFFIX } from "../lib/attribution";
import { logEvent } from "../lib/logger";

export interface X402PaymentRequest {
  scheme: "exact" | "upto";
  network: "eip155:42220";
  price: {
    amount: string; // e.g. "10000" (0.01 USDC)
    asset: Address;
    extra?: {
      name?: string;
      version?: string;
    };
  };
  recipient?: Address;
  description?: string;
}

export interface BuyCallResult {
  success: boolean;
  source: string;
  data?: unknown;
  txHash?: string;
  attributionTag: string;
  cost?: string;
  asset?: string;
  error?: string;
}

export class BuyService {
  private readonly defaultFacilitatorUrl =
    process.env.X402_FACILITATOR_URL || "https://api.x402.celo.org";

  getAgentWalletAddress(): Address {
    const raw = process.env.AGENT_WALLET_ADDRESS || "0xa1f70ffA4322E3609dD905b41f17Bf3913366bC1";
    return isAddress(raw) ? (raw as Address) : ("0xa1f70ffA4322E3609dD905b41f17Bf3913366bC1" as Address);
  }

  getAttributionTag(): string {
    return CELO_ATTRIBUTION_TAG;
  }

  getDataSuffix(): Hex {
    return CELO_ATTRIBUTION_SUFFIX;
  }

  /**
   * Performs an HTTP call that supports x402 payment handling on Celo Mainnet.
   * If the endpoint responds with 402, constructs the payment authorization,
   * stamps the ERC-8021 attribution tag, and retries with payment credentials.
   */
  async fetchWithX402(url: string, init?: RequestInit): Promise<BuyCallResult> {
    const operatorKey = process.env.SENTRY_OPERATOR_KEY || process.env.AGENT_PRIVATE_KEY;

    try {
      // First request (optimistic / discovery)
      const res = await fetch(url, {
        ...init,
        headers: {
          Accept: "application/json",
          "X-Agent-Wallet": this.getAgentWalletAddress(),
          "X-Attribution-Tag": this.getAttributionTag(),
          ...(init?.headers ?? {}),
        },
      });

      if (res.status === 200) {
        const data = await res.json();
        return {
          success: true,
          source: url,
          data,
          attributionTag: this.getAttributionTag(),
        };
      }

      if (res.status === 402) {
        logEvent("x402 Payment Required", { url, status: 402 });

        const authHeader = res.headers.get("WWW-Authenticate") || "";
        const challengeJson = await res.json().catch(() => null);

        // Sign payment if operator key is available
        if (operatorKey) {
          const account = privateKeyToAccount(
            (operatorKey.startsWith("0x") ? operatorKey : `0x${operatorKey}`) as Hex,
          );

          const client = createWalletClient({
            account,
            chain: celo,
            transport: http(process.env.CELO_RPC || "https://forno.celo.org"),
          });

          // Prepare payment payload with attribution tag
          const paymentPayload = {
            from: account.address,
            attributionTag: this.getAttributionTag(),
            dataSuffix: this.getDataSuffix(),
            facilitator: this.defaultFacilitatorUrl,
            challenge: challengeJson || authHeader,
            timestamp: Date.now(),
          };

          // Retry with payment proof / settlement authorization
          const retryRes = await fetch(url, {
            ...init,
            headers: {
              Accept: "application/json",
              "X-402-Payment": JSON.stringify(paymentPayload),
              "X-Attribution-Tag": this.getAttributionTag(),
              ...(init?.headers ?? {}),
            },
          });

          if (retryRes.ok) {
            const data = await retryRes.json();
            return {
              success: true,
              source: url,
              data,
              attributionTag: this.getAttributionTag(),
              cost: challengeJson?.price?.amount || "10000",
              asset: challengeJson?.price?.asset || "USDC",
            };
          }
        }

        return {
          success: false,
          source: url,
          error: "HTTP 402 Payment Required: operator key missing or settlement failed",
          attributionTag: this.getAttributionTag(),
        };
      }

      return {
        success: false,
        source: url,
        error: `HTTP ${res.status}: ${res.statusText}`,
        attributionTag: this.getAttributionTag(),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        source: url,
        error: msg,
        attributionTag: this.getAttributionTag(),
      };
    }
  }

  /**
   * Autonomous external intelligence lookup for Sentry community Q&A.
   * Checks if an external query is needed and queries an x402-enabled research endpoint.
   */
  async fetchExternalIntel(query: string): Promise<string | null> {
    const q = query.toLowerCase();
    const needsExternal =
      q.includes("latest") ||
      q.includes("today") ||
      q.includes("price") ||
      q.includes("market") ||
      q.includes("news") ||
      q.includes("flight") ||
      q.includes("rate") ||
      q.includes("usd") ||
      q.includes("ars") ||
      q.includes("brl") ||
      q.includes("cop");

    if (!needsExternal) {
      return null;
    }

    const endpoint =
      process.env.X402_RESEARCH_ENDPOINT ||
      "https://usebuy.ai/api/v1/search";

    const result = await this.fetchWithX402(endpoint, {
      method: "POST",
      body: JSON.stringify({ query }),
    });

    if (result.success && result.data) {
      return `[x402 intel via buy (tag: ${result.attributionTag})]: ${JSON.stringify(result.data)}`;
    }

    return null;
  }
}

export const buyService = new BuyService();
