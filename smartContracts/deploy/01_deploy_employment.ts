import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { isAddress } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log, execute, read } = deployments;
  const { deployer, treasury, operator, dd09 } = await getNamedAccounts();

  const usdm = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
  const usdc = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
  const usdt = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e";

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
  
  log(`EmploymentManager deployed at ${manager.address}`);

  const factory = await deploy("SentryWalletFactory", {
    from: deployer,
    args: [deployer, manager.address, usdm, usdc, usdt],
    log: true,
    waitConfirmations: network.live ? 2 : 1,
  });

  log(`SentryWalletFactory deployed at ${factory.address}`);

  const owner = await read("EmploymentManager", "owner");
  log(`EmploymentManager owner: ${owner}`);

  // --- RewardFactory ---

  log("----------------------------------------------------");
  log(`Deploying RewardFactory on ${network.name}`);
  log(`Owner: ${deployer}`);
  log(`Operator (Sentry): ${operator}`);

  const rewardFactory = await deploy("RewardFactory", {
    from: deployer,
    args: [deployer, operator, usdm, usdc, usdt],
    log: true,
    waitConfirmations: network.live ? 2 : 1,
  });

  log(`RewardFactory deployed at ${rewardFactory.address}`);
  log("Next: run `node sync-data.js` to sync address + ABI into ui/lib/contracts");


  // try {
  //   log("Transferring ownership of RewardFactory to new owner");
  //   const newOnwer = '0xdD0952E29078C2aA01D6a20b8C2a92CC77f9f33D';
  //   await execute("RewardFactory", {from: deployer},  'transferOwnership', newOnwer);
  //   log(`Ownership transferred to ${newOnwer}`);
  // } catch (error) {
  //   log(`Error executing RewardFactory: ${error}`);
  // }
  try {
    log("Setting new operator for RewardFactory");
    const newOperator = '0xdD0952E29078C2aA01D6a20b8C2a92CC77f9f33D';
    await execute("RewardFactory", {from: dd09},  'setOperator', newOperator);
    log(`Operator set to ${newOperator}`);
  } catch (error) {
    log(`Error executing RewardFactory: ${error}`);
  }
};

export default func;
func.tags = ["EmploymentManager", "SentryWalletFactory", "RewardFactory"];
