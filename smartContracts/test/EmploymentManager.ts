import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deploySystem } from "./helpers";

describe("EmploymentManager", function () {
  async function registeredEmployment() {
    const fixture = await deploySystem();
    await fixture.manager
      .connect(fixture.owner)
      .registerEmployment(fixture.user.address, fixture.walletAddress);
    return fixture;
  }

  it("registers and activates a validated employment", async function () {
    const { manager, owner, user, walletAddress } = await loadFixture(deploySystem);

    await expect(manager.connect(owner).registerEmployment(user.address, walletAddress))
      .to.emit(manager, "EmploymentRegistered")
      .withArgs(user.address, walletAddress);

    expect(await manager.walletOf(user.address)).to.equal(walletAddress);
    expect(await manager.userOfWallet(walletAddress)).to.equal(user.address);
    expect(await manager.employmentStatus(user.address)).to.equal(1);
  });

  it("rejects EOAs, wrong-owner wallets, duplicate users, and duplicate wallets", async function () {
    const { manager, owner, user, other, walletAddress, usdm, usdc, usdt } =
      await loadFixture(deploySystem);

    await expect(
      manager.connect(owner).registerEmployment(user.address, other.address),
    ).to.be.revertedWithCustomError(manager, "InvalidWallet");

    const Wallet = await ethers.getContractFactory("SentryWallet");
    const wrongOwnerWallet = await Wallet.deploy(
      other.address,
      await manager.getAddress(),
      ethers.id("wrong-owner"),
      await usdm.getAddress(),
      await usdc.getAddress(),
      await usdt.getAddress(),
    );
    await expect(
      manager
        .connect(owner)
        .registerEmployment(user.address, await wrongOwnerWallet.getAddress()),
    ).to.be.revertedWithCustomError(manager, "InvalidWallet");

    await manager.connect(owner).registerEmployment(user.address, walletAddress);
    await expect(
      manager.connect(owner).registerEmployment(user.address, walletAddress),
    ).to.be.revertedWithCustomError(manager, "EmploymentAlreadyRegistered");
    await expect(
      manager.connect(owner).registerEmployment(other.address, walletAddress),
    ).to.be.revertedWithCustomError(manager, "EmploymentAlreadyRegistered");
  });

  it("pauses, resumes, and exhausts only valid employment states", async function () {
    const { manager, operator, user } = await loadFixture(registeredEmployment);

    await expect(manager.connect(operator).pauseEmployment(user.address))
      .to.emit(manager, "EmploymentPaused")
      .withArgs(user.address);
    expect(await manager.employmentStatus(user.address)).to.equal(2);

    await expect(manager.connect(operator).resumeEmployment(user.address))
      .to.emit(manager, "EmploymentResumed")
      .withArgs(user.address);
    expect(await manager.employmentStatus(user.address)).to.equal(1);

    await expect(manager.connect(operator).exhaustEmployment(user.address))
      .to.emit(manager, "EmploymentExhausted")
      .withArgs(user.address);
    expect(await manager.employmentStatus(user.address)).to.equal(3);

    await expect(
      manager.connect(operator).resumeEmployment(user.address),
    ).to.be.revertedWithCustomError(manager, "InvalidStatus");
  });

  it("rejects unauthorized employment state changes", async function () {
    const { manager, user, other } = await loadFixture(registeredEmployment);

    await expect(
      manager.connect(other).pauseEmployment(user.address),
    ).to.be.revertedWithCustomError(manager, "UnauthorizedOperator");
  });

  it("executes settlement, transfers service plus fee, and prevents replay", async function () {
    const { manager, operator, treasury, user, walletAddress, usdm } = await loadFixture(
      registeredEmployment,
    );
    const service = ethers.parseEther("0.5");
    const fee = ethers.parseEther("0.01");
    const settlementId = ethers.id("settlement-1");
    await usdm.mint(walletAddress, ethers.parseEther("1"));

    await expect(
      manager
        .connect(operator)
        .chargeSettlement(user.address, settlementId, service, fee),
    )
      .to.emit(manager, "SettlementCompleted")
      .withArgs(user.address, walletAddress, settlementId, service, fee);

    expect(await usdm.balanceOf(treasury.address)).to.equal(service + fee);
    expect(await usdm.balanceOf(walletAddress)).to.equal(ethers.parseEther("0.49"));
    expect(await manager.settledBatches(settlementId)).to.equal(true);

    await expect(
      manager
        .connect(operator)
        .chargeSettlement(user.address, settlementId, service, fee),
    ).to.be.revertedWithCustomError(manager, "AlreadySettled");
  });

  it("rejects unauthorized settlements, invalid IDs, amounts, wallets, and statuses", async function () {
    const { manager, owner, operator, user, other, walletAddress, usdm } =
      await loadFixture(deploySystem);
    const settlementId = ethers.id("invalid-cases");

    await expect(
      manager.connect(other).chargeSettlement(user.address, settlementId, 1, 0),
    ).to.be.revertedWithCustomError(manager, "UnauthorizedOperator");
    await expect(
      manager.connect(operator).chargeSettlement(user.address, settlementId, 1, 0),
    ).to.be.revertedWithCustomError(manager, "InvalidWallet");

    await manager.connect(owner).registerEmployment(user.address, walletAddress);
    await usdm.mint(walletAddress, 100);
    await expect(
      manager.connect(operator).chargeSettlement(user.address, ethers.ZeroHash, 1, 0),
    ).to.be.revertedWithCustomError(manager, "InvalidSettlementId");
    await expect(
      manager.connect(operator).chargeSettlement(user.address, settlementId, 0, 1),
    ).to.be.revertedWithCustomError(manager, "InvalidAmount");

    await manager.connect(operator).pauseEmployment(user.address);
    await expect(
      manager.connect(operator).chargeSettlement(user.address, settlementId, 1, 0),
    ).to.be.revertedWithCustomError(manager, "InvalidStatus");
  });

  it("rejects settlements with insufficient funds without consuming replay ID", async function () {
    const { manager, operator, user } = await loadFixture(registeredEmployment);
    const settlementId = ethers.id("insufficient");

    await expect(
      manager
        .connect(operator)
        .chargeSettlement(user.address, settlementId, ethers.parseEther("1"), 0),
    ).to.be.reverted;
    expect(await manager.settledBatches(settlementId)).to.equal(false);
  });

  it("switches payment currency and rejects invalid enum values", async function () {
    const { manager, owner } = await loadFixture(deploySystem);

    await expect(manager.connect(owner).setPaymentToken(0))
      .to.emit(manager, "PaymentCurrencyChanged")
      .withArgs(1, 0);
    expect(await manager.activePaymentToken()).to.equal(0);
    await expect(manager.connect(owner).setPaymentToken(4)).to.be.reverted;
  });

  it("updates operator and treasury with zero-address protection", async function () {
    const { manager, owner, operator, treasury, other } = await loadFixture(deploySystem);

    await expect(manager.connect(owner).setOperator(other.address))
      .to.emit(manager, "OperatorUpdated")
      .withArgs(operator.address, other.address);
    await expect(manager.connect(owner).setTreasury(other.address))
      .to.emit(manager, "TreasuryUpdated")
      .withArgs(treasury.address, other.address);

    await expect(
      manager.connect(owner).setOperator(ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(manager, "ZeroAddress");
    await expect(
      manager.connect(owner).setTreasury(ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(manager, "ZeroAddress");
  });

  it("blocks settlements and employment state changes while globally paused", async function () {
    const { manager, owner, operator, user, walletAddress, usdm } = await loadFixture(
      registeredEmployment,
    );
    await usdm.mint(walletAddress, 100);
    await manager.connect(owner).pause();

    await expect(
      manager.connect(operator).pauseEmployment(user.address),
    ).to.be.revertedWithCustomError(manager, "EnforcedPause");
    await expect(
      manager.connect(operator).chargeSettlement(user.address, ethers.id("paused"), 1, 0),
    ).to.be.revertedWithCustomError(manager, "EnforcedPause");
    await expect(
      manager.connect(owner).registerEmployment(owner.address, walletAddress),
    ).to.be.revertedWithCustomError(manager, "EnforcedPause");

    await expect(manager.connect(owner).unpause())
      .to.emit(manager, "Unpaused")
      .withArgs(owner.address);
  });

  it("rejects zero addresses in constructor and registration", async function () {
    const { manager, owner, operator, treasury, user, walletAddress } = await loadFixture(
      deploySystem,
    );
    const Manager = await ethers.getContractFactory("EmploymentManager");

    await expect(
      Manager.deploy(owner.address, ethers.ZeroAddress, treasury.address),
    ).to.be.revertedWithCustomError(Manager, "ZeroAddress");
    await expect(
      Manager.deploy(owner.address, operator.address, ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(Manager, "ZeroAddress");
    await expect(
      manager.connect(owner).registerEmployment(ethers.ZeroAddress, walletAddress),
    ).to.be.revertedWithCustomError(manager, "ZeroAddress");
    await expect(
      manager.connect(owner).registerEmployment(user.address, ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(manager, "ZeroAddress");
  });
});
