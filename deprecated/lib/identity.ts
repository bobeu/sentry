import { getAddress, keccak256, toBytes, type Address, type Hex } from "viem";

/** Namespaced identity hash for on-chain registration. */
export function identityHash(namespace: "email" | "telegram" | "wallet", value: string) {
  const normalized =
    namespace === "email"
      ? value.trim().toLowerCase()
      : namespace === "wallet"
        ? value.toLowerCase()
        : value.trim();
  return keccak256(toBytes(`${namespace}:${normalized}`));
}

export function emailIdentityHash(email: string) {
  return identityHash("email", email);
}

export function telegramIdentityHash(telegramUserId: string) {
  return identityHash("telegram", telegramUserId);
}

/** Stable address-shaped on-chain identifier. It is never used as a custody key. */
export function identityUserKey(hash: Hex): Address {
  return getAddress(`0x${hash.slice(-40)}`);
}
