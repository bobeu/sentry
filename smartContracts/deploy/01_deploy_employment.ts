import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("----------------------------------------------------");
  log(`Network: ${network.name} (chainId=${network.config.chainId})`);
  log(`Deployer/operator: ${deployer}`);
  log("Deploying EmploymentContract...");

  const employment = await deploy("EmploymentContract", {
    from: deployer,
    args: [deployer],
    log: true,
    waitConfirmations: network.live ? 2 : 1,
  });

  log(`EmploymentContract deployed at ${employment.address}`);
};

export default func;
func.tags = ["EmploymentContract"];
