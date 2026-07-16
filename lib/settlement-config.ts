/** Configurable settlement thresholds (env-driven, not hardcoded). */
export type SettlementConfig = {
  monetaryThreshold: number;
  actionThreshold: number;
  intervalMinutes: number;
  feeEstimate: number;
  feeBufferPercent: number;
};

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw?.trim()) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getSettlementConfig(): SettlementConfig {
  return {
    monetaryThreshold: numEnv("SETTLEMENT_MONETARY_THRESHOLD", 0.5),
    actionThreshold: Math.floor(numEnv("SETTLEMENT_ACTION_THRESHOLD", 5)),
    intervalMinutes: Math.floor(numEnv("SETTLEMENT_INTERVAL_MINUTES", 15)),
    feeEstimate: numEnv("SETTLEMENT_FEE_ESTIMATE", 0.001),
    feeBufferPercent: numEnv("SETTLEMENT_FEE_BUFFER_PERCENT", 10),
  };
}

export function bufferedSettlementFee(config: SettlementConfig = getSettlementConfig()) {
  return config.feeEstimate * (1 + config.feeBufferPercent / 100);
}

export function settlementIntervalMs(config: SettlementConfig = getSettlementConfig()) {
  return config.intervalMinutes * 60 * 1000;
}
