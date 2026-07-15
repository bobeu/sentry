import { expect } from "chai";
import { ethers } from "hardhat";

describe("EmploymentWalletFactory", function () {
  async function deploy() {
    const [owner, operator] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockERC20");
    const usdm = await Mock.deploy("USDm");
    const usdc = await Mock.deploy("USDC");
    const usdt = await Mock.deploy("USDT");
    const Employment = await ethers.getContractFactory("EmploymentContract");
    const employment = await Employment.deploy(
      owner.address,
      operator.address,
      owner.address,
      await usdm.getAddress(),
      await usdc.getAddress(),
      await usdt.getAddress(),
    );
    await employment.waitForDeployment();

    const Factory = await ethers.getContractFactory("EmploymentWalletFactory");
    const factory = await Factory.deploy(operator.address, await employment.getAddress());
    await factory.waitForDeployment();
    await employment.connect(owner).setIdentityRegistrar(await factory.getAddress(), true);

    return { employment, factory, operator };
  }

  it("creates one wallet per identity hash", async function () {
    const { factory, operator, employment } = await deploy();
    const identityHash = ethers.id("email:alice@example.com");

    const tx = await factory.connect(operator).createWallet(identityHash);
    await tx.wait();

    const wallet = await factory.walletFor(identityHash);
    expect(wallet).to.properAddress;
    expect(await factory.walletFor(identityHash)).to.equal(wallet);

    const tx2 = await factory.connect(operator).createWallet(identityHash);
    await tx2.wait();
    expect(await factory.walletFor(identityHash)).to.equal(wallet);
    expect(await employment.identityWallet(identityHash)).to.equal(wallet);
  });
});
