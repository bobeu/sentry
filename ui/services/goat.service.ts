import { http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { SupportedNetwork } from "@/lib/networks";

type GoatEnvNetwork = "goat-mainnet" | "goat-testnet";

type GoatNetworkConfig = {
  network: GoatEnvNetwork;
  chainId: number;
  rpcUrl: string;
  identityRegistry: string;
  reputationRegistry: string;
};

type RegisterAgentResult = {
  agentId: string;
  txHash: string | null;
};

const GOAT_NETWORKS: Record<GoatEnvNetwork, GoatNetworkConfig> = {
  "goat-mainnet": {
    network: "goat-mainnet",
    chainId: 2345,
    rpcUrl: "https://rpc.goat.network",
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
  },
  "goat-testnet": {
    network: "goat-testnet",
    chainId: 48816,
    rpcUrl: "https://rpc.testnet3.goat.network",
    identityRegistry: "0x556089008Fc0a60cD09390Eca93477ca254A5522",
    reputationRegistry: "0xd9140951d8aE6E5F625a02F5908535e16e3af964",
  },
};

function getGoatNetworkConfig(): GoatNetworkConfig {
  const envNetwork = process.env.GOAT_NETWORK?.trim();
  const network: GoatEnvNetwork =
    envNetwork === "goat-mainnet" ? "goat-mainnet" : "goat-testnet";
  const base = GOAT_NETWORKS[network];
  return {
    ...base,
    rpcUrl: process.env.GOAT_RPC_URL?.trim() || base.rpcUrl,
  };
}

function getGoatPrivateKey() {
  const raw = process.env.GOAT_AGENT_PRIVATE_KEY?.trim();
  if (!raw) return null;
  return raw.startsWith("0x") ? (raw as `0x${string}`) : (`0x${raw}` as `0x${string}`);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function firstDefinedString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

export class GoatService {
  preferredNetworkLabel(network: SupportedNetwork): string {
    return network === "GOAT" ? "GOAT" : "CELO";
  }

  getConfig() {
    const config = getGoatNetworkConfig();
    return {
      ...config,
      registryIdentifier: `eip155:${config.chainId}:${config.identityRegistry}`,
      configured: Boolean(getGoatPrivateKey()),
    };
  }

  async ensureAgentKitRuntime() {
    const key = getGoatPrivateKey();
    if (!key) {
      throw new Error("GOAT_AGENT_PRIVATE_KEY is not configured");
    }

    const config = getGoatNetworkConfig();

    const providers = (await import("@goatnetwork/agentkit/providers")) as Record<string, unknown>;
    const plugins = (await import("@goatnetwork/agentkit/plugins")) as Record<string, unknown>;
    const core = (await import("@goatnetwork/agentkit/core")) as Record<string, unknown>;

    const ActionProvider = providers.ActionProvider as new () => {
      register: (action: unknown) => void;
      get: (name: string) => unknown;
      list: () => Array<{ name: string }>;
    };
    const PolicyEngine = core.PolicyEngine as new (config: Record<string, unknown>) => unknown;
    const ExecutionRuntime = core.ExecutionRuntime as new (
      policy: unknown,
      config: Record<string, unknown>,
    ) => {
      run: (
        action: unknown,
        context: Record<string, unknown>,
        input: Record<string, unknown>,
      ) => Promise<unknown>;
    };
    const ViemWalletProvider = core.ViemWalletProvider as new (
      account: unknown,
      chain: unknown,
      transport: unknown,
      network: string,
    ) => unknown;

    const registerAgent = plugins.erc8004RegisterAgentAction as (
      wallet: unknown,
    ) => unknown;
    const setAgentUri = plugins.erc8004SetAgentURIAction as (wallet: unknown) => unknown;

    const account = privateKeyToAccount(key);
    const chain = {
      id: config.chainId,
      name: config.network,
      nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 },
      rpcUrls: { default: { http: [config.rpcUrl] } },
    };

    const wallet = new ViemWalletProvider(account, chain, http(config.rpcUrl), config.network);
    const provider = new ActionProvider();
    provider.register(registerAgent(wallet));
    provider.register(setAgentUri(wallet));

    const policy = new PolicyEngine({
      allowedNetworks: [config.network],
      maxRiskWithoutConfirm: "high",
      writeEnabled: true,
    });
    const runtime = new ExecutionRuntime(policy, {
      maxRetries: 1,
      retryDelayMs: 250,
    });

    return { config, provider, runtime };
  }

  async registerAgent(agentUri?: string): Promise<RegisterAgentResult> {
    const { config, provider, runtime } = await this.ensureAgentKitRuntime();
    const action = provider.get("erc8004.register_agent");
    if (!action) throw new Error("AgentKit erc8004.register_agent action is unavailable");

    const input = agentUri ? { agentUri } : {};
    const result = await runtime.run(
      action,
      {
        traceId: `goat_reg_${Date.now()}`,
        network: config.network,
        now: Date.now(),
        caller: "sentry-ui",
      },
      input,
    );
    const data = asRecord(result);
    const output = asRecord(data.output);
    const agentId = firstDefinedString(output.agentId, output.id, data.agentId, data.id);
    if (!agentId) {
      throw new Error("GOAT registration completed but no agentId was returned");
    }
    const txHash = firstDefinedString(output.txHash, output.hash, data.txHash, data.hash);
    return { agentId, txHash };
  }

  async setAgentUri(agentId: string, agentUri: string): Promise<{ txHash: string | null }> {
    const { config, provider, runtime } = await this.ensureAgentKitRuntime();
    const action = provider.get("erc8004.set_agent_uri");
    if (!action) throw new Error("AgentKit erc8004.set_agent_uri action is unavailable");

    const result = await runtime.run(
      action,
      {
        traceId: `goat_uri_${Date.now()}`,
        network: config.network,
        now: Date.now(),
        caller: "sentry-ui",
      },
      {
        agentId,
        agentUri,
      },
    );
    const data = asRecord(result);
    const output = asRecord(data.output);
    const txHash = firstDefinedString(output.txHash, output.hash, data.txHash, data.hash);
    return { txHash };
  }
}

export const goatService = new GoatService();
