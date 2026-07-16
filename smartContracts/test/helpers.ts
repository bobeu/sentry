import { ethers } from "hardhat";

export async function deploySystem() {
  const [owner, operator, treasury, user, other] = await ethers.getSigners();

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const usdm = await MockERC20.deploy("USDm");
  const usdc = await MockERC20.deploy("USDC");
  const usdt = await MockERC20.deploy("USDT");

  const EmploymentManager = await ethers.getContractFactory("EmploymentManager");
  const manager = await EmploymentManager.deploy(
    owner.address,
    operator.address,
    treasury.address,
  );

  const SentryWalletFactory = await ethers.getContractFactory("SentryWalletFactory");
  const factory = await SentryWalletFactory.deploy(
    owner.address,
    await manager.getAddress(),
    await usdm.getAddress(),
    await usdc.getAddress(),
    await usdt.getAddress(),
  );

  const identityHash = ethers.id("email:user@example.com");
  await factory.connect(owner).createWallet(identityHash, user.address, 1);
  const walletAddress = await factory.walletOfIdentity(identityHash);
  const wallet = await ethers.getContractAt("SentryWallet", walletAddress);

  return {
    owner,
    operator,
    treasury,
    user,
    other,
    usdm,
    usdc,
    usdt,
    manager,
    factory,
    wallet,
    walletAddress,
    identityHash,
  };
}
