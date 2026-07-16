/**
 * Contract bindings synced from smartContracts/sync-data.js.
 * Replace after deployment.
 */

import addresses from "./addresses.json";
import abis from "./abis.json";

export type Address = `0x${string}`;

export const CONTRACTS = {
  EmploymentManager: {
    address: undefined as Address | undefined,
    addresses: (addresses as Record<string, Record<string, string>>).EmploymentManager ?? {},
    abi: ((abis as Record<string, unknown[]>).EmploymentManager ?? []) as readonly unknown[],
  },
  SentryWalletFactory: {
    address: undefined as Address | undefined,
    addresses:
      (addresses as Record<string, Record<string, string>>).SentryWalletFactory ?? {},
    abi: ((abis as Record<string, unknown[]>).SentryWalletFactory ?? []) as readonly unknown[],
  },
} as const;

export type ContractName = keyof typeof CONTRACTS;
