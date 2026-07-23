import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Standalone RewardFactory deploy — does not touch EmploymentManager / SentryWallet*.
 * Run explicitly when ready: `npx hardhat deploy --tags RewardFactory --network celo`
 * (Do not run as part of default employment deploy until intentional.)
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer, operator } = await getNamedAccounts();

  const usdm = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
  const usdc = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
  const usdt = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e";

  log("----------------------------------------------------");
  log(`Deploying RewardFactory on ${network.name}`);
  log(`Owner: ${deployer}`);
  log(`Operator (Sentry): ${operator}`);

  const factory = await deploy("RewardFactory", {
    from: deployer,
    args: [deployer, operator, usdm, usdc, usdt],
    log: true,
    waitConfirmations: network.live ? 2 : 1,
  });

  log(`RewardFactory deployed at ${factory.address}`);
  log("Next: set REWARD_FACTORY_ADDRESS and run `node sync-data.js`");
};

export default func;
func.tags = ["RewardFactory"];
func.skip = async () => true; // never auto-run; remove skip or use --tags when ready
