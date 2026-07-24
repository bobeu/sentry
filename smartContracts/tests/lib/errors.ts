/** Minimal error helpers for volume scripts (no Next.js Errors module). */
export const Errors = {
  blockchainUnavailable: () =>
    new Error("Blockchain service unavailable — check keys and contract addresses"),
  chargeFailed: (reason?: string) =>
    new Error(reason ?? "On-chain transaction failed"),
};
