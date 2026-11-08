import { toDataSuffix } from "@celo/attribution-tags";
import type { Hex } from "viem";

/** Agents on Open Rails Hackathon attribution tag for github.com/bobeu/sentry */
export const CELO_ATTRIBUTION_TAG = "celo_39f96dcb58cc";

/** ERC-8021 data suffix appended to every Celo transaction from Sentry. */
export const CELO_ATTRIBUTION_SUFFIX = toDataSuffix(
  CELO_ATTRIBUTION_TAG,
) as Hex;
