import { toDataSuffix } from "@celo/attribution-tags";
import type { Hex } from "viem";

/** DeFAI hackathon attribution tag for github.com/bobeu/sentry */
export const CELO_ATTRIBUTION_TAG = "celo_e3cc4c8d8a0e";

/** ERC-8021 data suffix appended to every Celo transaction from Sentry. */
export const CELO_ATTRIBUTION_SUFFIX = toDataSuffix(
  CELO_ATTRIBUTION_TAG,
) as Hex;
