const DEMO_SCALE = 100;

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/** Scale production pricing down for safe judge demos (e.g. 0.01 → 0.0001). */
export function demoPrice(base: number): number {
  return isDemoMode() ? base / DEMO_SCALE : base;
}
