import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deploySystem } from "./helpers";

describe("EmploymentManager", function () {
  async function registered() {
    const fixture = await deploySystem();
    await fixture.manager
      .connect(fixture.owner)
      .registerEmployment(fixture.user.address, fixture.walletAddress);
    return fixture;
  }

  it("registers a manager-controlled wallet and activates it", async function () {
    const { manager, owner, user, wallet, walletAddress } = await loadFixture(deploySystem);
    await expect(manager.connect(owner).registerEmployment(user.address, walletAddress))
      .to.emit(manager, "EmploymentRegistered")
      .withArgs(user.address, walletAddress);
    expect(await manager.walletOf(user.address)).to.equal(walletAddress);
    expect(await wallet.status()).to.equal(1);
  });

  it("rejects invalid wallets, duplicates, and zero addresses", async function () {
    const { manager, owner, user, other, walletAddress } = await loadFixture(deploySystem);
    await expect(
      manager.connect(owner).registerEmployment(ethers.ZeroAddress, walletAddress),
    ).to.be.revertedWithCustomError(manager, "ZeroAddress");
    await expect(
      manager.connect(owner).registerEmployment(user.address, other.address),
    ).to.be.revertedWithCustomError(manager, "InvalidWallet");
    await manager.connect(owner).registerEmployment(user.address, walletAddress);
    await expect(
      manager.connect(owner).registerEmployment(user.address, walletAddress),
    ).to.be.revertedWithCustomError(manager, "EmploymentAlreadyRegistered");
  });

  it("manages employment lifecycle and global pause/unpause", async function () {
    const { manager, owner, operator, user } = await loadFixture(registered);
    await manager.connect(operator).pauseEmployment(user.address);
    expect(await manager.employmentStatus(user.address)).to.equal(2);
    await expect(
      manager.connect(operator).chargeSettlement(user.address, ethers.id("paused"), 1, 0),
    ).to.be.revertedWithCustomError(manager, "InvalidStatus");
    await manager.connect(operator).resumeEmployment(user.address);
    await manager.connect(operator).exhaustEmployment(user.address);
    expect(await manager.employmentStatus(user.address)).to.equal(3);
    await manager.connect(owner).pause();
    await expect(
      manager.connect(operator).resumeEmployment(user.address),
    ).to.be.revertedWithCustomError(manager, "EnforcedPause");
    await manager.connect(owner).unpause();
  });

  it("settles using each wallet's own currency", async function () {
    const { manager, factory, owner, operator, treasury, user, walletAddress, usdm } =
      await loadFixture(registered);
    await usdm.mint(walletAddress, 500);
    await manager
      .connect(operator)
      .chargeSettlement(user.address, ethers.id("usd-settlement"), 200, 10);
    expect(await usdm.balanceOf(treasury.address)).to.equal(210);

    const identity = ethers.id("native");
    const [, , , , other] = await ethers.getSigners();
    await factory.connect(owner).createWallet(identity, other.address, 0);
    const nativeAddress = await factory.walletOfIdentity(identity);
    await manager.connect(owner).registerEmployment(other.address, nativeAddress);
    await owner.sendTransaction({ to: nativeAddress, value: 500 });
    await expect(() =>
      manager
        .connect(operator)
        .chargeSettlement(other.address, ethers.id("celo-settlement"), 200, 10),
    ).to.changeEtherBalances([nativeAddress, treasury], [-210, 210]);
  });

  it("sets and enforces the registered withdrawal destination", async function () {
    const { manager, operator, user, other, walletAddress, usdm } =
      await loadFixture(registered);
    await usdm.mint(walletAddress, 500);
    await expect(
      manager.connect(operator).withdraw(user.address, ethers.id("missing-destination"), 100),
    ).to.be.revertedWithCustomError(manager, "WithdrawalDestinationNotSet");
    await expect(
      manager.connect(operator).setWithdrawalDestination(user.address, ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(manager, "ZeroAddress");

    await expect(
      manager.connect(operator).setWithdrawalDestination(user.address, other.address),
    )
      .to.emit(manager, "WithdrawalDestinationUpdated")
      .withArgs(user.address, ethers.ZeroAddress, other.address);
    await manager.connect(operator).withdraw(user.address, ethers.id("withdraw"), 100);
    expect(await usdm.balanceOf(other.address)).to.equal(100);
  });

  it("atomically settles outstanding charges before withdrawal", async function () {
    const { manager, operator, treasury, user, other, walletAddress, usdm } =
      await loadFixture(registered);
    await manager.connect(operator).setWithdrawalDestination(user.address, other.address);
    await usdm.mint(walletAddress, 1_000);

    await manager.connect(operator).settleAndWithdraw(
      user.address,
      ethers.id("settle-first"),
      200,
      10,
      ethers.id("withdraw-after"),
      500,
    );
    expect(await usdm.balanceOf(treasury.address)).to.equal(210);
    expect(await usdm.balanceOf(other.address)).to.equal(500);
    expect(await usdm.balanceOf(walletAddress)).to.equal(290);
  });

  it("rejects unauthorized, replayed, invalid, and insufficient withdrawals", async function () {
    const { manager, operator, user, other, walletAddress, usdm } =
      await loadFixture(registered);
    await manager.connect(operator).setWithdrawalDestination(user.address, other.address);
    await usdm.mint(walletAddress, 100);
    const id = ethers.id("withdrawal");

    await expect(
      manager.connect(other).withdraw(user.address, id, 1),
    ).to.be.revertedWithCustomError(manager, "UnauthorizedOperator");
    await expect(
      manager.connect(operator).withdraw(user.address, ethers.ZeroHash, 1),
    ).to.be.revertedWithCustomError(manager, "InvalidWithdrawalId");
    await expect(
      manager.connect(operator).withdraw(user.address, id, 0),
    ).to.be.revertedWithCustomError(manager, "InvalidAmount");
    await expect(manager.connect(operator).withdraw(user.address, id, 101)).to.be.reverted;
    expect(await manager.processedWithdrawals(id)).to.equal(false);
    await manager.connect(operator).withdraw(user.address, id, 100);
    await expect(
      manager.connect(operator).withdraw(user.address, id, 1),
    ).to.be.revertedWithCustomError(manager, "WithdrawalAlreadyProcessed");
  });

  it("prevents settlement replay and invalid settlement ids", async function () {
    const { manager, operator, user, walletAddress, usdm } = await loadFixture(registered);
    await usdm.mint(walletAddress, 100);
    const id = ethers.id("settlement");
    await manager.connect(operator).chargeSettlement(user.address, id, 90, 10);
    await expect(
      manager.connect(operator).chargeSettlement(user.address, id, 1, 0),
    ).to.be.revertedWithCustomError(manager, "AlreadySettled");
    await expect(
      manager.connect(operator).chargeSettlement(user.address, ethers.ZeroHash, 1, 0),
    ).to.be.revertedWithCustomError(manager, "InvalidSettlementId");
  });

  it("rejects settlement when insufficient balance and does not consume the id", async function () {
    const { manager, operator, user, walletAddress } = await loadFixture(registered);
    const id = ethers.id("insufficient");
    await expect(
      manager.connect(operator).chargeSettlement(user.address, id, 50, 1),
    ).to.be.reverted;
    expect(await manager.settledBatches(id)).to.equal(false);
    expect(await ethers.provider.getCode(walletAddress)).to.not.equal("0x");
  });

  it("supports operator/treasury updates and funding notification", async function () {
    const { manager, owner, operator, other, user, wallet, walletAddress } =
      await loadFixture(registered);
    await expect(manager.connect(owner).setOperator(other.address))
      .to.emit(manager, "OperatorUpdated")
      .withArgs(operator.address, other.address);
    await expect(
      manager.connect(owner).setTreasury(ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(manager, "ZeroAddress");
    await manager.connect(owner).setTreasury(other.address);
    await manager.connect(owner).setOperator(operator.address);
    await expect(
      manager.connect(operator).notifyWalletFunding(user.address, other.address, 25),
    )
      .to.emit(wallet, "WalletFunded")
      .withArgs(walletAddress, other.address, 25, 1);
  });

  it("rejects unauthorized manager admin actions", async function () {
    const { manager, other, user } = await loadFixture(registered);
    await expect(manager.connect(other).pause()).to.be.revertedWithCustomError(
      manager,
      "OwnableUnauthorizedAccount",
    );
    await expect(
      manager.connect(other).lockWallet(user.address),
    ).to.be.revertedWithCustomError(manager, "UnauthorizedOperator");
    await expect(
      manager.connect(other).archiveWallet(user.address),
    ).to.be.revertedWithCustomError(manager, "OwnableUnauthorizedAccount");
  });
});
