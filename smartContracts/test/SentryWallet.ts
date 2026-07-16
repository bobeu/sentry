import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deploySystem } from "./helpers";

describe("SentryWallet", function () {
  it("stores immutable identity, manager, and currency", async function () {
    const { wallet, manager, identityHash, usdm } = await loadFixture(deploySystem);
    expect(await wallet.identityHash()).to.equal(identityHash);
    expect(await wallet.manager()).to.equal(await manager.getAddress());
    expect(await wallet.paymentCurrency()).to.equal(1);
    expect(await wallet.tokenAddress()).to.equal(await usdm.getAddress());
  });

  it("reports its configured ERC20 balance", async function () {
    const { wallet, walletAddress, usdm } = await loadFixture(deploySystem);
    await usdm.mint(walletAddress, 500);
    expect(await wallet.balance()).to.equal(500);
  });

  it("rejects direct user withdrawals", async function () {
    const { wallet, user } = await loadFixture(deploySystem);
    await expect(
      wallet.connect(user).withdrawTo(user.address, 1, ethers.id("unauthorized")),
    ).to.be.revertedWithCustomError(wallet, "UnauthorizedManager");
  });

  it("settles and withdraws only when called by EmploymentManager", async function () {
    const { manager, wallet, walletAddress, owner, operator, treasury, user, other, usdm } =
      await loadFixture(deploySystem);
    await manager.connect(owner).registerEmployment(user.address, walletAddress);
    await manager.connect(operator).setWithdrawalDestination(user.address, other.address);
    await usdm.mint(walletAddress, 1_000);

    await manager
      .connect(operator)
      .chargeSettlement(user.address, ethers.id("settlement"), 200, 10);
    await manager.connect(operator).withdraw(user.address, ethers.id("withdrawal"), 300);

    expect(await usdm.balanceOf(treasury.address)).to.equal(210);
    expect(await usdm.balanceOf(other.address)).to.equal(300);
    expect(await wallet.balance()).to.equal(490);
  });

  it("supports native CELO wallets", async function () {
    const { factory, owner, manager, other } = await loadFixture(deploySystem);
    const identity = ethers.id("native-wallet");
    await factory.connect(owner).createWallet(identity, other.address, 0);
    const address = await factory.walletOfIdentity(identity);
    const wallet = await ethers.getContractAt("SentryWallet", address);
    await owner.sendTransaction({ to: address, value: ethers.parseEther("1") });
    expect(await wallet.balance()).to.equal(ethers.parseEther("1"));
    expect(await wallet.manager()).to.equal(await manager.getAddress());
    expect(await wallet.tokenAddress()).to.equal(ethers.ZeroAddress);
  });

  it("rejects native CELO sent to an ERC20 wallet", async function () {
    const { walletAddress, other, wallet } = await loadFixture(deploySystem);
    await expect(
      other.sendTransaction({ to: walletAddress, value: 1 }),
    ).to.be.revertedWithCustomError(wallet, "InvalidTokenConfig");
  });
});
