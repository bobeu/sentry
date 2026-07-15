import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const usdm = process.env.CELO_USDM_ADDRESS ?? "0x0000000000000000000000000000000000000001";
  const usdc = process.env.CELO_USDC_ADDRESS ?? "0x0000000000000000000000000000000000000002";
  const usdt = process.env.CELO_USDT_ADDRESS ?? "0x0000000000000000000000000000000000000003";
  const treasury = process.env.SENTRY_TREASURY_ADDRESS ?? deployer;

  log("----------------------------------------------------");
  log(`Network: ${network.name} (chainId=${network.config.chainId})`);
  log(`Deployer/owner: ${deployer}`);
  log(`Operator: ${deployer}`);
  log(`Treasury: ${treasury}`);
  log("Deploying EmploymentContract...");

  const employment = await deploy("EmploymentContract", {
    from: deployer,
    args: [deployer, deployer, treasury, usdm, usdc, usdt],
    log: true,
    waitConfirmations: network.live ? 2 : 1,
  });

  log(`EmploymentContract deployed at ${employment.address}`);
};

export default func;
func.tags = ["EmploymentContract"];
