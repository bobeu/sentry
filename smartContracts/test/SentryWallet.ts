import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deploySystem } from "./helpers";

describe("SentryWallet", function () {
  it("stores version, identity, manager, currency, and provisioning status", async function () {
    const { wallet, manager, identityHash, usdm } = await loadFixture(deploySystem);
    expect(await wallet.VERSION()).to.equal(1);
    expect(await wallet.identityHash()).to.equal(identityHash);
    expect(await wallet.manager()).to.equal(await manager.getAddress());
    expect(await wallet.paymentCurrency()).to.equal(1);
    expect(await wallet.tokenAddress()).to.equal(await usdm.getAddress());
    expect(await wallet.status()).to.equal(0);
  });

  it("activates on employment registration and emits WalletFunded for CELO deposits", async function () {
    const { wallet, walletAddress, manager, factory, owner, user, other } =
      await loadFixture(deploySystem);
    await expect(manager.connect(owner).registerEmployment(user.address, walletAddress))
      .to.emit(wallet, "WalletStatusChanged")
      .withArgs(0, 1);
    expect(await wallet.status()).to.equal(1);

    const celoIdentity = ethers.id("celo-funded");
    await factory.connect(owner).createWallet(celoIdentity, other.address, 0);
    const celoAddress = await factory.walletOfIdentity(celoIdentity);
    const celoWallet = await ethers.getContractAt("SentryWallet", celoAddress);
    await expect(owner.sendTransaction({ to: celoAddress, value: 100 }))
      .to.emit(celoWallet, "WalletFunded")
      .withArgs(celoAddress, owner.address, 100, 0);
  });

  it("reports ERC20 balance and rejects unauthorized withdrawals", async function () {
    const { wallet, walletAddress, usdm, user } = await loadFixture(deploySystem);
    await usdm.mint(walletAddress, 500);
    expect(await wallet.balance()).to.equal(500);
    await expect(
      wallet.connect(user).withdrawTo(user.address, 1, ethers.id("unauthorized")),
    ).to.be.revertedWithCustomError(wallet, "UnauthorizedManager");
    await expect(
      wallet.connect(user).executeSettlement(user.address, 1, ethers.id("x")),
    ).to.be.revertedWithCustomError(wallet, "UnauthorizedManager");
  });

  it("settles and withdraws only via EmploymentManager when active", async function () {
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

  it("blocks settlements and withdrawals while locked", async function () {
    const { manager, walletAddress, owner, operator, user, other, usdm } =
      await loadFixture(deploySystem);
    await manager.connect(owner).registerEmployment(user.address, walletAddress);
    await manager.connect(operator).setWithdrawalDestination(user.address, other.address);
    await usdm.mint(walletAddress, 500);
    await manager.connect(operator).lockWallet(user.address);

    await expect(
      manager.connect(operator).chargeSettlement(user.address, ethers.id("locked"), 10, 1),
    ).to.be.revertedWithCustomError(
      await ethers.getContractAt("SentryWallet", walletAddress),
      "InvalidWalletStatus",
    );
    await expect(
      manager.connect(operator).withdraw(user.address, ethers.id("locked-w"), 10),
    ).to.be.revertedWithCustomError(
      await ethers.getContractAt("SentryWallet", walletAddress),
      "InvalidWalletStatus",
    );

    await manager.connect(operator).unlockWallet(user.address);
    await manager.connect(operator).chargeSettlement(user.address, ethers.id("unlocked"), 10, 1);
  });

  it("rejects native CELO sent to an ERC20 wallet and zero amounts", async function () {
    const { walletAddress, other, wallet, manager, owner, operator, user, treasury } =
      await loadFixture(deploySystem);
    await expect(
      other.sendTransaction({ to: walletAddress, value: 1 }),
    ).to.be.revertedWithCustomError(wallet, "InvalidTokenConfig");

    await manager.connect(owner).registerEmployment(user.address, walletAddress);
    await expect(
      manager.connect(operator).chargeSettlement(user.address, ethers.id("zero"), 0, 0),
    ).to.be.revertedWithCustomError(manager, "InvalidAmount");
    await expect(
      manager.connect(operator).notifyWalletFunding(user.address, treasury.address, 0),
    ).to.be.revertedWithCustomError(wallet, "InvalidAmount");
  });

  it("archives wallets permanently", async function () {
    const { manager, wallet, walletAddress, owner, user } = await loadFixture(deploySystem);
    await manager.connect(owner).registerEmployment(user.address, walletAddress);
    await manager.connect(owner).archiveWallet(user.address);
    expect(await wallet.status()).to.equal(3);
    await expect(
      manager.connect(owner).archiveWallet(user.address),
    ).to.be.revertedWithCustomError(wallet, "InvalidWalletStatus");
  });
});
