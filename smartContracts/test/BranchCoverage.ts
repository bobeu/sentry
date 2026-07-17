import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deploySystem } from "./helpers";

describe("Branch coverage edges", function () {
  it("rejects zero constructor addresses and wrong manager wallets", async function () {
    const Manager = await ethers.getContractFactory("EmploymentManager");
    const [owner, operator, treasury] = await ethers.getSigners();
    await expect(
      Manager.deploy(owner.address, ethers.ZeroAddress, treasury.address),
    ).to.be.revertedWithCustomError(Manager, "ZeroAddress");
    await expect(
      Manager.deploy(owner.address, operator.address, ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(Manager, "ZeroAddress");

    const {
      manager,
      owner: depOwner,
      operator: depOperator,
      treasury: depTreasury,
      other,
      usdm,
      usdc,
      usdt,
    } = await loadFixture(deploySystem);

    const otherManager = await Manager.deploy(
      depOwner.address,
      depOperator.address,
      depTreasury.address,
    );
    const foreignFactory = await (
      await ethers.getContractFactory("SentryWalletFactory")
    ).deploy(
      depOwner.address,
      await otherManager.getAddress(),
      await usdm.getAddress(),
      await usdc.getAddress(),
      await usdt.getAddress(),
    );
    await foreignFactory
      .connect(depOwner)
      .createWallet(ethers.id("foreign"), other.address, 1);
    const foreignWallet = await foreignFactory.walletOfIdentity(ethers.id("foreign"));
    await expect(
      manager.connect(depOwner).registerEmployment(other.address, foreignWallet),
    ).to.be.revertedWithCustomError(manager, "InvalidWallet");
  });

  it("covers no-op admin updates and invalid employment transitions", async function () {
    const { manager, owner, operator, user, other, walletAddress, usdm } =
      await loadFixture(deploySystem);
    await manager.connect(owner).registerEmployment(user.address, walletAddress);

    await manager.connect(owner).setOperator(operator.address);
    await manager.connect(owner).setTreasury(await manager.treasury());
    await manager.connect(operator).setWithdrawalDestination(user.address, other.address);
    await manager.connect(operator).setWithdrawalDestination(user.address, other.address);

    await expect(
      manager.connect(operator).resumeEmployment(user.address),
    ).to.be.revertedWithCustomError(manager, "InvalidStatus");
    await manager.connect(operator).pauseEmployment(user.address);
    await expect(
      manager.connect(operator).pauseEmployment(user.address),
    ).to.be.revertedWithCustomError(manager, "InvalidStatus");
    await manager.connect(operator).exhaustEmployment(user.address);
    await expect(
      manager.connect(operator).exhaustEmployment(user.address),
    ).to.be.revertedWithCustomError(manager, "InvalidStatus");

    await expect(
      manager.connect(operator).chargeSettlement(other.address, ethers.id("nouser"), 1, 0),
    ).to.be.revertedWithCustomError(manager, "InvalidWallet");
    await expect(
      manager.connect(operator).withdraw(other.address, ethers.id("nouser-w"), 1),
    ).to.be.revertedWithCustomError(manager, "InvalidWallet");
    await expect(
      manager.connect(operator).lockWallet(other.address),
    ).to.be.revertedWithCustomError(manager, "InvalidWallet");
    await expect(
      manager.connect(operator).notifyWalletFunding(other.address, other.address, 1),
    ).to.be.revertedWithCustomError(manager, "InvalidWallet");
    await expect(
      manager.connect(owner).archiveWallet(other.address),
    ).to.be.revertedWithCustomError(manager, "InvalidWallet");

    await usdm.mint(walletAddress, 1);
  });

  it("covers factory no-ops, views, and wallet constructor validation", async function () {
    const { factory, owner, identityHash, usdm, usdc, usdt } = await loadFixture(deploySystem);
    await factory.connect(owner).setCurrencyEnabled(1, true);
    await factory.connect(owner).updateTokenAddress(1, await usdm.getAddress());
    expect(await factory.walletFromIdentity(identityHash)).to.not.equal(ethers.ZeroAddress);
    expect(await factory.walletFromUser(owner.address)).to.equal(ethers.ZeroAddress);

    const Wallet = await ethers.getContractFactory("SentryWallet");
    await expect(
      Wallet.deploy(ethers.ZeroAddress, ethers.id("x"), 1, await usdm.getAddress()),
    ).to.be.revertedWithCustomError(Wallet, "ZeroAddress");
    await expect(
      Wallet.deploy(owner.address, ethers.ZeroHash, 1, await usdm.getAddress()),
    ).to.be.revertedWithCustomError(Wallet, "InvalidIdentity");
    await expect(
      Wallet.deploy(owner.address, ethers.id("celo-bad"), 0, await usdm.getAddress()),
    ).to.be.revertedWithCustomError(Wallet, "InvalidTokenConfig");
    await expect(
      Wallet.deploy(owner.address, ethers.id("erc20-bad"), 1, ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(Wallet, "InvalidTokenConfig");

    void usdc;
    void usdt;
  });

  it("covers wallet lifecycle guards and native transfer failure", async function () {
    const { manager, factory, wallet, walletAddress, owner, operator, user, other } =
      await loadFixture(deploySystem);

    await expect(wallet.connect(owner).activate()).to.be.revertedWithCustomError(
      wallet,
      "UnauthorizedManager",
    );
    await expect(wallet.lockWallet()).to.be.revertedWithCustomError(
      wallet,
      "UnauthorizedManager",
    );

    await manager.connect(owner).registerEmployment(user.address, walletAddress);
    await expect(wallet.connect(operator).activate()).to.be.revertedWithCustomError(
      wallet,
      "UnauthorizedManager",
    );

    const Reject = await ethers.getContractFactory("RejectEther");
    const rejector = await Reject.deploy();
    const celoId = ethers.id("reject-celo");
    await factory.connect(owner).createWallet(celoId, other.address, 0);
    const celoAddress = await factory.walletOfIdentity(celoId);
    const celoWallet = await ethers.getContractAt("SentryWallet", celoAddress);
    await manager.connect(owner).registerEmployment(other.address, celoAddress);
    await owner.sendTransaction({ to: celoAddress, value: 50 });
    expect(await celoWallet.balance()).to.equal(50);

    await manager
      .connect(operator)
      .setWithdrawalDestination(other.address, await rejector.getAddress());
    await expect(
      manager.connect(operator).withdraw(other.address, ethers.id("reject"), 10),
    ).to.be.revertedWithCustomError(celoWallet, "NativeTransferFailed");
    expect(await manager.processedWithdrawals(ethers.id("reject"))).to.equal(false);

    await manager.connect(operator).lockWallet(user.address);
    await expect(
      manager.connect(operator).lockWallet(user.address),
    ).to.be.revertedWithCustomError(wallet, "InvalidWalletStatus");
    await manager.connect(operator).unlockWallet(user.address);
    await expect(
      manager.connect(operator).unlockWallet(user.address),
    ).to.be.revertedWithCustomError(wallet, "InvalidWalletStatus");
  });

  it("covers paused manager settlement path and zero wallet registration", async function () {
    const { manager, owner, operator, user, walletAddress } = await loadFixture(deploySystem);
    await manager.connect(owner).registerEmployment(user.address, walletAddress);
    await manager.connect(owner).pause();
    await expect(
      manager.connect(operator).chargeSettlement(user.address, ethers.id("paused-settle"), 1, 0),
    ).to.be.revertedWithCustomError(manager, "EnforcedPause");
    await expect(
      manager.connect(owner).registerEmployment(user.address, ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(manager, "EnforcedPause");
    await manager.connect(owner).unpause();
    await expect(
      manager.connect(owner).registerEmployment(user.address, ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(manager, "ZeroAddress");
  });
});
