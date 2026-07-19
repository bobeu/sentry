import type { HardhatUserConfig } from "hardhat/config";
import { config as dotconfig } from "dotenv";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import "@nomiclabs/hardhat-web3";
import "@nomicfoundation/hardhat-viem";

dotconfig();

const config: HardhatUserConfig = {
  
  networks: {
    sepolia: {
      url: "https://forno.celo-sepolia.celo-testnet.org",
      accounts: [process.env.KEY_ROUTE ? process.env.KEY_ROUTE.replace(/[^a-fA-F0-9x]/g, '').slice(0, 66) : "0x0000000000000000000000000000000000000000000000000000000000000001"],
      chainId: 11_142220,
      saveDeployments: true
    },
    celo: {
      accounts: [process.env.KEY_FAR ? process.env.KEY_FAR.replace(/[^a-fA-F0-9x]/g, '').slice(0, 66) : "0x0000000000000000000000000000000000000000000000000000000000000001"],
      url: 'https://forno.celo.org', // || 'https://celo.drpc.org'
      chainId: 42220,
      // gas: 8000000,
      // gasPrice: 1000000000,
      saveDeployments: true
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "./deploy"
  },

  etherscan: {
    apiKey: process.env.CELOSCAN_API_KEY ?? '',
    customChains: [
      {
        chainId: 11142220,
        network: 'celoSepolia',
        urls: {
          apiURL: 'https://api.etherscan.io/v2/api',
          browserURL: 'https://sepolia.celoscan.io',
        },
      },
      {
        chainId: 42220,
        network: 'celo',
        urls: {
          apiURL: 'https://api.etherscan.io/v2/api',
          browserURL: 'https://celoscan.io/',
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
      11142220: `privatekey://${process.env.KEY_ROUTE}`,
      42220: `privatekey://${process.env.KEY_FAR}`,
    },
    treasury: {
      default: 0,
      11142220: `privatekey://${process.env.TREASURY}`,
      42220: `privatekey://${process.env.TREASURY}`,
    },
    operator: {
      default: 0,
      11142220: `privatekey://${process.env.OPERATOR}`,
      42220: `privatekey://${process.env.OPERATOR}`,
    },
    dd09: {
      default: 0,
      11142220: `privatekey://${process.env.NEW_OWNER}`,
      42220: `privatekey://${process.env.NEW_OWNER}`,
    }
  },

  solidity: {
    version: "0.8.28",
    settings: {          // See the solidity docs for advice about optimization and evmVersion
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: 'cancun',
      }
    },
};

export default config;