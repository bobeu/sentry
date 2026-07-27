/** Configurable settlement thresholds and billing mode (env-driven). */

export type SettlementMode = "instant" | "batch";

export type SettlementConfig = {
  /**
   * instant — one on-chain chargeSettlement per completed billable action (max DeFAI volume).
   * batch — accumulate outstanding charges until monetary/action/time thresholds (lower gas).
   */
  mode: SettlementMode;
  monetaryThreshold: number;
  actionThreshold: number;
  intervalMinutes: number;
  /** Base settlement fee charged in wallet currency units (covers operator gas). */
  feeEstimate: number;
  feeBufferPercent: number;
  /** When true, try to raise feeEstimate from live Celo gas for CELO wallets. */
  estimateGasOnChain: boolean;
};

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw?.trim()) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function modeEnv(): SettlementMode {
  const raw = (process.env.SETTLEMENT_MODE ?? "instant").trim().toLowerCase();
  return raw === "batch" ? "batch" : "instant";
}

export function getSettlementConfig(): SettlementConfig {
  return {
    mode: modeEnv(),
    monetaryThreshold: numEnv("SETTLEMENT_MONETARY_THRESHOLD", 0.5),
    actionThreshold: Math.max(1, Math.floor(numEnv("SETTLEMENT_ACTION_THRESHOLD", 5))),
    intervalMinutes: Math.max(1, Math.floor(numEnv("SETTLEMENT_INTERVAL_MINUTES", 15))),
    feeEstimate: numEnv("SETTLEMENT_FEE_ESTIMATE", 0.001),
    feeBufferPercent: numEnv("SETTLEMENT_FEE_BUFFER_PERCENT", 10),
    estimateGasOnChain:
      (process.env.SETTLEMENT_ESTIMATE_GAS ?? "true").trim().toLowerCase() !==
      "false",
  };
}

export function bufferedSettlementFee(config: SettlementConfig = getSettlementConfig()) {
  return config.feeEstimate * (1 + config.feeBufferPercent / 100);
}

export function settlementIntervalMs(config: SettlementConfig = getSettlementConfig()) {
  return config.intervalMinutes * 60 * 1000;
}
