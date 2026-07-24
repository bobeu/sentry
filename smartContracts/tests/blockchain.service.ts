import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  isAddress,
  parseUnits,
  zeroAddress,
  type Abi,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { CELO_ATTRIBUTION_SUFFIX } from "./lib/attribution";
import {
  CONTRACTS,
  REWARD_ACCOUNT_ABI,
  RPC_URL,
  estimateAndTopUpForContract,
  topUpIfNeeded,
} from "./lib/utils";
import { txFeeOpts } from "./lib/fee-currency";
import type { PaymentCurrency } from "./lib/payment-currency";
import { tokenDecimals } from "./lib/payment-currency";
import { Errors } from "./lib/errors";
import type { VolumeAccount } from "./lib/accounts";

const TOKEN_INDEX: Record<PaymentCurrency, number> = {
  CELO: 0,
  USDm: 1,
  USDC: 2,
  USDT: 3,
};

const walletAbi = [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "employmentManager",
          "type": "address"
        },
        {
          "internalType": "bytes32",
          "name": "identityHash_",
          "type": "bytes32"
        },
        {
          "internalType": "enum SentryWallet.Token",
          "name": "currency_",
          "type": "uint8"
        },
        {
          "internalType": "address",
          "name": "tokenAddress_",
          "type": "address"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [],
      "name": "InvalidAmount",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidIdentity",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidTokenConfig",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidWalletStatus",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "NativeTransferFailed",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "ReentrancyGuardReentrantCall",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "token",
          "type": "address"
        }
      ],
      "name": "SafeERC20FailedOperation",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "UnauthorizedManager",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "ZeroAddress",
      "type": "error"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "NativeReceived",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "treasury",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "enum SentryWallet.Token",
          "name": "token",
          "type": "uint8"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "settlementId",
          "type": "bytes32"
        }
      ],
      "name": "SettlementExecuted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "wallet",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "enum SentryWallet.Token",
          "name": "currency",
          "type": "uint8"
        }
      ],
      "name": "WalletFunded",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "enum SentryWallet.WalletStatus",
          "name": "previousStatus",
          "type": "uint8"
        },
        {
          "indexed": true,
          "internalType": "enum SentryWallet.WalletStatus",
          "name": "newStatus",
          "type": "uint8"
        }
      ],
      "name": "WalletStatusChanged",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "enum SentryWallet.Token",
          "name": "token",
          "type": "uint8"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "withdrawalId",
          "type": "bytes32"
        }
      ],
      "name": "Withdrawal",
      "type": "event"
    },
    {
      "inputs": [],
      "name": "VERSION",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "activate",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "archiveWallet",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "balance",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "treasury",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        },
        {
          "internalType": "bytes32",
          "name": "settlementId",
          "type": "bytes32"
        }
      ],
      "name": "executeSettlement",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "identityHash",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "lockWallet",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "manager",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "notifyFunding",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "paymentCurrency",
      "outputs": [
        {
          "internalType": "enum SentryWallet.Token",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "status",
      "outputs": [
        {
          "internalType": "enum SentryWallet.WalletStatus",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "tokenAddress",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "unlockWallet",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "destination",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        },
        {
          "internalType": "bytes32",
          "name": "withdrawalId",
          "type": "bytes32"
        }
      ],
      "name": "withdrawTo",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "stateMutability": "payable",
      "type": "receive"
    }
] as const;

function key(name: "owner" | "operator"): Hex | null {
  // Privileged roles always come from env — accounts.json entries are userKeys /
  // transfer EOAs (via VolumeAccount constructor), not factory/manager signers.
  const raw =
    name === "owner"
      ? process.env.SENTRY_OWNER_KEY ??
        process.env.EMPLOYMENT_OWNER_KEY ??
        process.env.PRIVATE_KEY
      : process.env.SENTRY_OPERATOR_KEY ??
        process.env.EMPLOYMENT_OPERATOR_KEY ??
        process.env.PRIVATE_KEY;
  if (!raw?.trim()) return null;
  return (raw.trim().startsWith("0x") ? raw.trim() : `0x${raw.trim()}`) as Hex;
}

function configuredAddress(
  envName: string,
  contract: Address,
): Address | null {
  const candidate = process.env[envName] ?? contract;
  return candidate && isAddress(candidate) ? (candidate as Address) : null;
}

/**
 * Bind the next privileged/account tx to a private key from accounts.json
 * (instead of wallet-provider / env-only keys).
 */
export function withVolumeSigner(account: VolumeAccount) {
  process.env.VOLUME_SIGNER_KEY = account.private_key;
  return account;
}

export function clearVolumeSigner() {
  delete process.env.VOLUME_SIGNER_KEY;
}

export class BlockchainService {
  /** Optional explicit account for non-privileged account-scoped txs. */
  constructor(private readonly volumeAccount?: VolumeAccount) {}

  private signerAccount(): PrivateKeyAccount | null {
    if (this.volumeAccount) return this.volumeAccount.account;
    const pk = key("operator");
    if (!pk) return null;
    return privateKeyToAccount(pk);
  }
  private client() {
    return createPublicClient({
      chain: celo,
      transport: http(RPC_URL),
    });
  }

  private managerAddress() {
    return configuredAddress(
      "EMPLOYMENT_MANAGER_ADDRESS",
      CONTRACTS.EmploymentManager.address,
    );
  }

  private factoryAddress() {
    return configuredAddress(
      "SENTRY_WALLET_FACTORY_ADDRESS",
      CONTRACTS.SentryWalletFactory.address,
    );
  }

  private rewardFactoryAddress() {
    return configuredAddress(
      "REWARD_FACTORY_ADDRESS",
      CONTRACTS.RewardFactory.address,
    );
  }

  private walletClient(kind: "owner" | "operator", address: Address | null) {
    // Owner ops always use SENTRY_OWNER_KEY / EMPLOYMENT_OWNER_KEY.
    // Operator ops: prefer env factory/manager operator; VOLUME_SIGNER_KEY only when
    // env operator is unset (legacy). accounts.json identities are userKeys, not signers
    // for create/register/charge/payout.
    const privateKey = key(kind);
    if (!privateKey || !address) return null;
    const account = privateKeyToAccount(privateKey);
    return {
      account,
      address,
      wallet: createWalletClient({
        account,
        chain: celo,
        transport: http(RPC_URL),
      }),
    };
  }

  /**
   * Estimate gas for the upcoming write, top up the signer via FUNDER_KEY if needed,
   * and return gas limit to attach to writeContract.
   */
  private async prepareGas(input: {
    account: PrivateKeyAccount;
    address: Address;
    abi: Abi;
    functionName: string;
    args?: readonly unknown[];
    value?: bigint;
  }) {
    const funded = await estimateAndTopUpForContract(input);
    if (!funded) {
      throw new Error(
        `Insufficient CELO for ${input.functionName} and FUNDER_KEY top-up failed`,
      );
    }
    return { gas: funded.gas };
  }

  /** writeContract with gas estimate + FUNDER_KEY top-up + attribution. */
  private async writeAttributed(input: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wallet: { writeContract: (args: any) => Promise<Hash> };
    account: PrivateKeyAccount;
    address: Address;
    abi: Abi;
    functionName: string;
    args?: readonly unknown[];
    value?: bigint;
  }): Promise<Hash> {
    const gasOpts = await this.prepareGas({
      account: input.account,
      address: input.address,
      abi: input.abi,
      functionName: input.functionName,
      args: input.args,
      value: input.value,
    });
    const hash = await input.wallet.writeContract({
      address: input.address,
      abi: input.abi,
      functionName: input.functionName,
      args: input.args,
      value: input.value,
      account: input.account,
      chain: celo,
      gas: gasOpts.gas,
      dataSuffix: CELO_ATTRIBUTION_SUFFIX,
      ...txFeeOpts(),
    });
    await this.requireSuccess(hash);
    return hash;
  }

  isConfigured() {
    return Boolean(this.managerAddress() && key("operator"));
  }

  isFactoryConfigured() {
    return Boolean(this.factoryAddress() && key("owner"));
  }

  connect() {
    return {
      connected: this.isConfigured(),
      network: "celo-mainnet",
      chainId: 42220,
      employmentManager: this.managerAddress(),
      walletFactory: this.factoryAddress(),
    };
  }

  async getEmploymentBalance(address: string, currency: PaymentCurrency) {
    if (!isAddress(address)) return null;
    try {
      const nativeBalance = await this.client().getBalance({ address: address as Address });
      if (currency === "CELO") {
        return {
          wei: nativeBalance.toString(),
          balance: formatUnits(nativeBalance, tokenDecimals(currency)),
          contract: address,
        };
      }
      const raw = await this.client().readContract({
        address: address as Address,
        abi: walletAbi,
        functionName: "balance",
      });
      return {
        wei: raw.toString(),
        balance: formatUnits(raw, tokenDecimals(currency)),
        contract: address,
      };
    } catch {
      return null;
    }
  }

  async syncBalanceCache(
    address: Address,
    currency: PaymentCurrency,
  ): Promise<number | null> {
    const result = await this.getEmploymentBalance(address, currency);
    if (result == null || result.balance == null || result.balance === "") {
      return null;
    }
    // getEmploymentBalance returns { wei, balance, contract }.
    // Number(result) is NaN and Prisma then reports "Argument `balance` is missing".
    const amount = Number(result.balance);
    return Number.isFinite(amount) ? amount : null;
  }

  async getWalletTokenAddress(address: Address): Promise<Address | null> {
    try {
      const token = await this.client().readContract({
        address,
        abi: walletAbi,
        functionName: "tokenAddress",
      });
      return token === zeroAddress
        ? null
        : (token as Address);
    } catch {
      return null;
    }
  }

  async ensureSentryWallet(input: {
    identityHash: Hex;
    userKey: Address;
    currency: PaymentCurrency;
  }): Promise<Address> {
    const factory = this.factoryAddress();
    const owner = this.walletClient("owner", factory);
    if (!factory || !owner) throw Errors.blockchainUnavailable();

    const existing = await this.client().readContract({
      address: factory,
      abi: CONTRACTS.SentryWalletFactory.abi,
      functionName: "walletOfIdentity",
      args: [input.identityHash],
    });
    if (existing !== zeroAddress) {
      return existing as Address;
    }

    await this.writeAttributed({
      wallet: owner.wallet,
      account: owner.account,
      address: factory,
      abi: CONTRACTS.SentryWalletFactory.abi,
      functionName: "createWallet",
      args: [input.identityHash, input.userKey, TOKEN_INDEX[input.currency]],
    });
    return (await this.client().readContract({
      address: factory,
      abi: CONTRACTS.SentryWalletFactory.abi,
      functionName: "walletOfIdentity",
      args: [input.identityHash],
    })) as Address;
  }

  async registerEmploymentOnChain(userKey: Address, walletAddress: Address) {
    const manager = this.managerAddress();
    const owner = this.walletClient("owner", manager);
    if (!manager || !owner) throw Errors.blockchainUnavailable();

    const registered = await this.client().readContract({
      address: manager,
      abi: CONTRACTS.EmploymentManager.abi,
      functionName: "walletOf",
      args: [userKey],
    });
    if (registered === walletAddress) return null;
    if (registered !== zeroAddress) {
      throw new Error("User key is registered to a different Sentry wallet");
    }

    return this.writeAttributed({
      wallet: owner.wallet,
      account: owner.account,
      address: manager,
      abi: CONTRACTS.EmploymentManager.abi,
      functionName: "registerEmployment",
      args: [userKey, walletAddress],
    });
  }

  async chargeSettlementOnChain(input: {
    userKey: Address;
    currency: PaymentCurrency;
    serviceAmount: number;
    settlementFee: number;
    settlementId: Hex;
  }) {
    const manager = this.managerAddress();
    const operator = this.walletClient("operator", manager);
    if (!manager || !operator) throw Errors.blockchainUnavailable();
    return this.writeAttributed({
      wallet: operator.wallet,
      account: operator.account,
      address: manager,
      abi: CONTRACTS.EmploymentManager.abi,
      functionName: "chargeSettlement",
      args: [
        input.userKey,
        input.settlementId,
        parseUnits(input.serviceAmount.toString(), tokenDecimals(input.currency)),
        parseUnits(input.settlementFee.toString(), tokenDecimals(input.currency)),
      ],
    });
  }

  /**
   * Estimate operator gas cost for chargeSettlement in native CELO.
   * Returns null when estimation is unavailable (caller should use configured fee).
   */
  async estimateChargeSettlementFeeCelo(input: {
    userKey: Address;
    currency: PaymentCurrency;
    serviceAmount: number;
    settlementFee: number;
    settlementId: Hex;
  }): Promise<number | null> {
    const manager = this.managerAddress();
    const operator = this.walletClient("operator", manager);
    if (!manager || !operator || !this.isConfigured()) return null;
    try {
      const args = [
        input.userKey,
        input.settlementId,
        parseUnits(input.serviceAmount.toString(), tokenDecimals(input.currency)),
        parseUnits(input.settlementFee.toString(), tokenDecimals(input.currency)),
      ] as const;
      const gas = await this.client().estimateContractGas({
        address: manager,
        abi: CONTRACTS.EmploymentManager.abi,
        functionName: "chargeSettlement",
        args,
        account: operator.account,
      });
      const fees = await this.client().estimateFeesPerGas().catch(() => null);
      const gasPrice =
        fees?.maxFeePerGas ??
        fees?.gasPrice ??
        (await this.client().getGasPrice());
      const costWei = gas * gasPrice;
      const celo = Number(formatUnits(costWei, 18));
      if (!Number.isFinite(celo) || celo <= 0) return null;
      // Small safety bump so the reserved fee covers fee market spikes.
      return celo * 1.25;
    } catch (err) {
      console.warn("[blockchain] fee estimate failed", err);
      return null;
    }
  }

  async setWithdrawalDestination(userKey: Address, destination: Address) {
    const manager = this.managerAddress();
    const operator = this.walletClient("operator", manager);
    if (!manager || !operator) throw Errors.blockchainUnavailable();
    return this.writeAttributed({
      wallet: operator.wallet,
      account: operator.account,
      address: manager,
      abi: CONTRACTS.EmploymentManager.abi,
      functionName: "setWithdrawalDestination",
      args: [userKey, destination],
    });
  }

  async withdrawOnChain(
    userKey: Address,
    withdrawalId: Hex,
    amount: number,
    currency: PaymentCurrency,
  ) {
    const manager = this.managerAddress();
    const operator = this.walletClient("operator", manager);
    if (!manager || !operator) throw Errors.blockchainUnavailable();
    return this.writeAttributed({
      wallet: operator.wallet,
      account: operator.account,
      address: manager,
      abi: CONTRACTS.EmploymentManager.abi,
      functionName: "withdraw",
      args: [
        userKey,
        withdrawalId,
        parseUnits(amount.toString(), tokenDecimals(currency)),
      ],
    });
  }

  async pauseOnChain(userKey: Address) {
    return this.writeEmploymentState("pauseEmployment", userKey);
  }

  async resumeOnChain(userKey: Address) {
    return this.writeEmploymentState("resumeEmployment", userKey);
  }

  async notifyWalletFunding(
    userKey: Address,
    from: Address,
    amount: number,
    currency: PaymentCurrency,
  ) {
    const manager = this.managerAddress();
    const operator = this.walletClient("operator", manager);
    if (!manager || !operator) return null;
    return this.writeAttributed({
      wallet: operator.wallet,
      account: operator.account,
      address: manager,
      abi: CONTRACTS.EmploymentManager.abi,
      functionName: "notifyWalletFunding",
      args: [
        userKey,
        from,
        parseUnits(amount.toString(), tokenDecimals(currency)),
      ],
    });
  }

  async setCurrencyEnabled(currency: PaymentCurrency, enabled: boolean) {
    const factory = this.factoryAddress();
    const owner = this.walletClient("owner", factory);
    if (!factory || !owner) throw Errors.blockchainUnavailable();
    return this.writeAttributed({
      wallet: owner.wallet,
      account: owner.account,
      address: factory,
      abi: CONTRACTS.SentryWalletFactory.abi,
      functionName: "setCurrencyEnabled",
      args: [TOKEN_INDEX[currency], enabled],
    });
  }

  async updateTokenAddress(currency: PaymentCurrency, tokenAddress: Address) {
    const factory = this.factoryAddress();
    const owner = this.walletClient("owner", factory);
    if (!factory || !owner) throw Errors.blockchainUnavailable();
    return this.writeAttributed({
      wallet: owner.wallet,
      account: owner.account,
      address: factory,
      abi: CONTRACTS.SentryWalletFactory.abi,
      functionName: "updateTokenAddress",
      args: [TOKEN_INDEX[currency], tokenAddress],
    });
  }

  getManagerAddress() {
    return this.managerAddress();
  }

  getFactoryAddress() {
    return this.factoryAddress();
  }

  private async writeEmploymentState(
    functionName: "pauseEmployment" | "resumeEmployment",
    userKey: Address,
  ) {
    const manager = this.managerAddress();
    const operator = this.walletClient("operator", manager);
    if (!manager || !operator) throw Errors.blockchainUnavailable();
    return this.writeAttributed({
      wallet: operator.wallet,
      account: operator.account,
      address: manager,
      abi: CONTRACTS.EmploymentManager.abi,
      functionName,
      args: [userKey],
    });
  }

  private async requireSuccess(hash: Hash) {
    const receipt = await this.client().waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw Errors.chargeFailed("Transaction reverted on-chain");
    }
  }

  isRewardFactoryConfigured() {
    const addr = this.rewardFactoryAddress();
    return Boolean(
      addr &&
        addr !== zeroAddress &&
        key("owner") &&
        (CONTRACTS.RewardFactory.abi?.length ?? 0) > 0,
    );
  }

  /**
   * Create or return existing multi-currency RewardAccount for accountKey.
   */
  async ensureRewardAccount(input: {
    accountKey: Hex;
    employer: Address;
  }): Promise<Address> {
    const factory = this.rewardFactoryAddress();
    const owner = this.walletClient("owner", factory);
    if (!factory || !owner) throw Errors.blockchainUnavailable();

    const existing = await this.client().readContract({
      address: factory,
      abi: CONTRACTS.RewardFactory.abi,
      functionName: "accountOfKey",
      args: [input.accountKey],
    });
    if (existing && (existing as Address) !== zeroAddress) {
      return existing as Address;
    }

    await this.writeAttributed({
      wallet: owner.wallet,
      account: owner.account,
      address: factory,
      abi: CONTRACTS.RewardFactory.abi,
      functionName: "createAccount",
      args: [input.accountKey, input.employer],
    });
    return (await this.client().readContract({
      address: factory,
      abi: CONTRACTS.RewardFactory.abi,
      functionName: "accountOfKey",
      args: [input.accountKey],
    })) as Address;
  }

  async rewardAccountBalance(
    accountAddress: Address,
    currency: PaymentCurrency = "USDm",
  ): Promise<bigint> {
    return (await this.client().readContract({
      address: accountAddress,
      abi: REWARD_ACCOUNT_ABI,
      functionName: "balance",
      args: [TOKEN_INDEX[currency]],
    })) as bigint;
  }

  async rewardAccountBalances(accountAddress: Address): Promise<{
    CELO: bigint;
    USDm: bigint;
    USDC: bigint;
    USDT: bigint;
  }> {
    const result = (await this.client().readContract({
      address: accountAddress,
      abi: REWARD_ACCOUNT_ABI,
      functionName: "balances",
    })) as readonly [bigint, bigint, bigint, bigint];
    return {
      CELO: result[0],
      USDm: result[1],
      USDC: result[2],
      USDT: result[3],
    };
  }

  /** Member payout via RewardFactory (operator only). */
  async payoutReward(input: {
    accountKey: Hex;
    to: Address;
    amount: bigint;
    payoutId: Hex;
    currency: PaymentCurrency;
  }): Promise<Hash> {
    const factory = this.rewardFactoryAddress();
    const operator = this.walletClient("operator", factory);
    if (!factory || !operator) throw Errors.blockchainUnavailable();

    return this.writeAttributed({
      wallet: operator.wallet,
      account: operator.account,
      address: factory,
      abi: CONTRACTS.RewardFactory.abi,
      functionName: "payout",
      args: [
        input.accountKey,
        input.to,
        input.amount,
        input.payoutId,
        TOKEN_INDEX[input.currency],
      ],
    });
  }

  /** Operator withdraws surplus above pending reserves to the employer. */
  async withdrawRewardToEmployer(input: {
    accountKey: Hex;
    pendingCELO?: bigint;
    pendingUSDm?: bigint;
    pendingUSDC?: bigint;
    pendingUSDT?: bigint;
  }): Promise<Hash> {
    const factory = this.rewardFactoryAddress();
    const operator = this.walletClient("operator", factory);
    if (!factory || !operator) throw Errors.blockchainUnavailable();
    return this.writeAttributed({
      wallet: operator.wallet,
      account: operator.account,
      address: factory,
      abi: CONTRACTS.RewardFactory.abi,
      functionName: "withdrawToEmployer",
      args: [
        input.accountKey,
        input.pendingCELO ?? 0n,
        input.pendingUSDm ?? 0n,
        input.pendingUSDC ?? 0n,
        input.pendingUSDT ?? 0n,
      ],
    });
  }

  async pauseRewardAccount(accountKey: Hex): Promise<Hash> {
    const factory = this.rewardFactoryAddress();
    const owner = this.walletClient("owner", factory);
    if (!factory || !owner) throw Errors.blockchainUnavailable();
    return this.writeAttributed({
      wallet: owner.wallet,
      account: owner.account,
      address: factory,
      abi: CONTRACTS.RewardFactory.abi,
      functionName: "pauseAccount",
      args: [accountKey],
    });
  }

  async pauseRewardAccountByOperator(accountKey: Hex): Promise<Hash> {
    const factory = this.rewardFactoryAddress();
    const operator = this.walletClient("operator", factory);
    if (!factory || !operator) throw Errors.blockchainUnavailable();
    return this.writeAttributed({
      wallet: operator.wallet,
      account: operator.account,
      address: factory,
      abi: CONTRACTS.RewardFactory.abi,
      functionName: "pauseAccountByOperator",
      args: [accountKey],
    });
  }

  async resumeRewardAccount(accountKey: Hex): Promise<Hash> {
    const factory = this.rewardFactoryAddress();
    const owner = this.walletClient("owner", factory);
    if (!factory || !owner) throw Errors.blockchainUnavailable();
    return this.writeAttributed({
      wallet: owner.wallet,
      account: owner.account,
      address: factory,
      abi: CONTRACTS.RewardFactory.abi,
      functionName: "resumeAccount",
      args: [accountKey],
    });
  }

  async resumeRewardAccountByOperator(accountKey: Hex): Promise<Hash> {
    const factory = this.rewardFactoryAddress();
    const operator = this.walletClient("operator", factory);
    if (!factory || !operator) throw Errors.blockchainUnavailable();
    return this.writeAttributed({
      wallet: operator.wallet,
      account: operator.account,
      address: factory,
      abi: CONTRACTS.RewardFactory.abi,
      functionName: "resumeAccountByOperator",
      args: [accountKey],
    });
  }

  private funderAccount(): PrivateKeyAccount {
    const raw = (process.env.FUNDER_KEY || "").trim();
    if (!raw) throw new Error("FUNDER_KEY not set");
    const pk = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
    return privateKeyToAccount(pk);
  }

  /** Resolve employer receive address for reward account creation. */
  resolveEmployerAddress(): Address {
    const fromEnv = (process.env.EMPLOYER_ADDRESS || "").trim();
    if (fromEnv && isAddress(fromEnv)) return fromEnv as Address;
    return this.funderAccount().address;
  }

  private async fundAddress(input: {
    to: Address;
    currency: PaymentCurrency;
    amount: number;
  }): Promise<Hash> {
    const funder = this.funderAccount();
    const wallet = createWalletClient({
      account: funder,
      chain: celo,
      transport: http(RPC_URL),
    });
    const amountWei = parseUnits(
      String(input.amount),
      tokenDecimals(input.currency),
    );

    if (input.currency === "CELO") {
      const hash = await wallet.sendTransaction({
        to: input.to,
        value: amountWei,
        account: funder,
        chain: celo,
      });
      await this.requireSuccess(hash);
      return hash;
    }

    const factory = this.rewardFactoryAddress();
    if (!factory) throw Errors.blockchainUnavailable();
    const tokenCfg = (await this.client().readContract({
      address: factory,
      abi: CONTRACTS.RewardFactory.abi,
      functionName: "currencies",
      args: [TOKEN_INDEX[input.currency]],
    })) as [Address, boolean];
    const token = tokenCfg[0];
    if (!token || token === zeroAddress) {
      throw new Error(`No token address configured for ${input.currency}`);
    }

    const erc20Abi = [
      {
        type: "function",
        name: "transfer",
        stateMutability: "nonpayable",
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ type: "bool" }],
      },
    ] as const;

    const hash = await wallet.writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "transfer",
      args: [input.to, amountWei],
      account: funder,
      chain: celo,
    });
    await this.requireSuccess(hash);
    return hash;
  }

  /** Fund a Sentry employment wallet from FUNDER_KEY. */
  async fundEmploymentWallet(input: {
    walletAddress: Address;
    currency: PaymentCurrency;
    amount: number;
  }): Promise<Hash> {
    return this.fundAddress({
      to: input.walletAddress,
      currency: input.currency,
      amount: input.amount,
    });
  }

  /** Fund a RewardAccount from FUNDER_KEY. */
  async fundRewardAccount(input: {
    accountAddress: Address;
    currency: PaymentCurrency;
    amount: number;
  }): Promise<Hash> {
    return this.fundAddress({
      to: input.accountAddress,
      currency: input.currency,
      amount: input.amount,
    });
  }

  /** Look up registered employment wallet for userKey (never invent EOA). */
  async employmentWalletOf(userKey: Address): Promise<Address | null> {
    const manager = this.managerAddress();
    if (!manager) return null;
    const registered = await this.client().readContract({
      address: manager,
      abi: CONTRACTS.EmploymentManager.abi,
      functionName: "walletOf",
      args: [userKey],
    });
    if (!registered || registered === zeroAddress) return null;
    return registered as Address;
  }

  /**
   * Native CELO transfer with ERC-8021 attribution suffix — high-volume path.
   */
  async sendNativeAttributed(input: {
    to: Address;
    amountWei: bigint;
  }): Promise<Hash> {
    const signer = this.signerAccount();
    if (!signer) throw Errors.blockchainUnavailable();
    const wallet = createWalletClient({
      account: signer,
      chain: celo,
      transport: http(RPC_URL),
    });

    const publicClient = this.client();
    let gasEstimate: bigint;
    try {
      gasEstimate = await publicClient.estimateGas({
        account: signer,
        to: input.to,
        value: input.amountWei,
        data: CELO_ATTRIBUTION_SUFFIX,
        gasPrice: 0n,
      });
    } catch (err: any) {
      throw new Error(`Gas estimation failed: ${err?.message ?? err}`);
    }
    const gasPrice = await publicClient.getGasPrice();
    const gas = (gasEstimate * 101n) / 100n;
    const required = gas * gasPrice + input.amountWei;
    console.log(
      `    ⛽  Gas estimate: ${gasEstimate} units (+1% overhead) ≈ ${formatUnits(gas * gasPrice, 18)} CELO`,
    );
    const funded = await topUpIfNeeded(signer.address, required);
    if (!funded) {
      throw new Error("Insufficient CELO for transfer and FUNDER_KEY top-up failed");
    }

    const hash = await wallet.sendTransaction({
      account: signer,
      chain: celo,
      to: input.to,
      value: input.amountWei,
      gas,
      dataSuffix: CELO_ATTRIBUTION_SUFFIX,
      ...txFeeOpts(),
    });
    await this.requireSuccess(hash);
    return hash;
  }
}

export const blockchainService = new BlockchainService();
