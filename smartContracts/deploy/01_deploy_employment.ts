import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { isAddress } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const localTokens = {
    usdm: "0x0000000000000000000000000000000000000001",
    usdc: "0x0000000000000000000000000000000000000002",
    usdt: "0x0000000000000000000000000000000000000003",
  };
  const usdm = process.env.CELO_USDM_ADDRESS ?? localTokens.usdm;
  const usdc = process.env.CELO_USDC_ADDRESS ?? localTokens.usdc;
  const usdt = process.env.CELO_USDT_ADDRESS ?? localTokens.usdt;
  const treasury = process.env.SENTRY_TREASURY_ADDRESS ?? deployer;
  const operator = process.env.SENTRY_OPERATOR_ADDRESS ?? deployer;

  if (network.name === "celo") {
    const required = [
      ["CELO_USDM_ADDRESS", process.env.CELO_USDM_ADDRESS],
      ["CELO_USDC_ADDRESS", process.env.CELO_USDC_ADDRESS],
      ["CELO_USDT_ADDRESS", process.env.CELO_USDT_ADDRESS],
      ["SENTRY_TREASURY_ADDRESS", process.env.SENTRY_TREASURY_ADDRESS],
    ] as const;
    for (const [name, value] of required) {
      if (!value || !isAddress(value)) {
        throw new Error(`${name} must be a valid address for Celo deployment`);
      }
    }
  }

  log("----------------------------------------------------");
  log(`Network: ${network.name} (chainId=${network.config.chainId})`);
  log(`Owner/deployer: ${deployer}`);
  log(`Operator: ${operator}`);
  log(`Treasury: ${treasury}`);

  const manager = await deploy("EmploymentManager", {
    from: deployer,
    args: [deployer, operator, treasury],
    log: true,
    waitConfirmations: network.live ? 2 : 1,
  });

  const factory = await deploy("SentryWalletFactory", {
    from: deployer,
    args: [deployer, manager.address, usdm, usdc, usdt],
    log: true,
    waitConfirmations: network.live ? 2 : 1,
  });

  log(`EmploymentManager deployed at ${manager.address}`);
  log(`SentryWalletFactory deployed at ${factory.address}`);
};

export default func;
func.tags = ["Sentry"];
