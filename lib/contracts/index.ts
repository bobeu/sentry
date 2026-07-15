/**
 * Contract bindings synced from smartContracts/sync-data.js.
 * Replace after deployment.
 */

import addresses from "./addresses.json";
import abis from "./abis.json";

export type Address = `0x${string}`;

export const CONTRACTS = {
  EmploymentContract: {
    address: undefined as Address | undefined,
    addresses: (addresses as Record<string, Record<string, string>>).EmploymentContract ?? {},
    abi: ((abis as Record<string, unknown[]>).EmploymentContract ?? []) as readonly unknown[],
  },
} as const;

export type ContractName = keyof typeof CONTRACTS;
