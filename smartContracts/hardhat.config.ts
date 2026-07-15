import type { HardhatUserConfig } from "hardhat/config";
import { config as dotconfig } from "dotenv";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";

dotconfig();

const placeholderKey =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

function cleanKey(value?: string) {
  if (!value) return placeholderKey;
  const cleaned = value.replace(/[^a-fA-F0-9x]/g, "").slice(0, 66);
  return cleaned.startsWith("0x") ? cleaned : `0x${cleaned}`;
}

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      saveDeployments: true,
      chainId: 42220,
    },
    celo: {
      url: "https://forno.celo.org",
      accounts: [cleanKey(process.env.KEY_FAR ?? process.env.PRIVATE_KEY)],
      chainId: 42_220,
      saveDeployments: true,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "./deploy",
  },
  etherscan: {
    apiKey: process.env.CELOSCAN_API_KEY ?? "",
    customChains: [
      {
        chainId: 42220,
        network: "celo",
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://celoscan.io/",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
};

export default config;
