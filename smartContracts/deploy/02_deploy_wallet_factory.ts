import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network, ethers } = hre;
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const employment = await get("EmploymentContract");

  log("----------------------------------------------------");
  log(`Network: ${network.name} (chainId=${network.config.chainId})`);
  log("Deploying EmploymentWalletFactory...");

  const factory = await deploy("EmploymentWalletFactory", {
    from: deployer,
    args: [deployer, employment.address],
    log: true,
    waitConfirmations: network.live ? 2 : 1,
  });

  log(`EmploymentWalletFactory deployed at ${factory.address}`);

  const employmentContract = await ethers.getContractAt(
    "EmploymentContract",
    employment.address,
  );
  const tx = await employmentContract.setIdentityRegistrar(factory.address, true);
  await tx.wait();
  log(`Authorized factory ${factory.address} as identity registrar`);
};

export default func;
func.tags = ["EmploymentWalletFactory"];
func.dependencies = ["EmploymentContract"];
