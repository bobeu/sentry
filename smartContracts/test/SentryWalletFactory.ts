import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deploySystem } from "./helpers";

describe("SentryWalletFactory", function () {
  it("creates CELO, USDm, and USDC wallets with immutable currencies", async function () {
    const { factory, owner, user, other, usdc } = await loadFixture(deploySystem);
    const [, , , , , fifth] = await ethers.getSigners();

    await factory.connect(owner).createWallet(ethers.id("celo"), other.address, 0);
    await factory.connect(owner).createWallet(ethers.id("usdc"), fifth.address, 2);

    const celoWallet = await ethers.getContractAt(
      "SentryWallet",
      await factory.walletOfIdentity(ethers.id("celo")),
    );
    const usdcWallet = await ethers.getContractAt(
      "SentryWallet",
      await factory.walletOfIdentity(ethers.id("usdc")),
    );
    expect(await celoWallet.paymentCurrency()).to.equal(0);
    expect(await celoWallet.tokenAddress()).to.equal(ethers.ZeroAddress);
    expect(await usdcWallet.paymentCurrency()).to.equal(2);
    expect(await usdcWallet.tokenAddress()).to.equal(await usdc.getAddress());
    expect(await factory.walletFromUser(user.address)).to.not.equal(ethers.ZeroAddress);
  });

  it("rejects disabled currencies for new wallets", async function () {
    const { factory, owner, other } = await loadFixture(deploySystem);
    await factory.connect(owner).setCurrencyEnabled(3, false);
    await expect(
      factory.connect(owner).createWallet(ethers.id("usdt"), other.address, 3),
    ).to.be.revertedWithCustomError(factory, "CurrencyDisabled");
  });

  it("keeps existing wallets operational after currency is disabled", async function () {
    const { factory, owner, wallet, walletAddress, usdm } =
      await loadFixture(deploySystem);
    await factory.connect(owner).setCurrencyEnabled(1, false);
    await usdm.mint(walletAddress, 100);
    expect(await wallet.balance()).to.equal(100);
    expect(await wallet.paymentCurrency()).to.equal(1);
  });

  it("updates token policy only for future wallets", async function () {
    const { factory, owner, other, wallet, usdm } = await loadFixture(deploySystem);
    const Mock = await ethers.getContractFactory("MockERC20");
    const replacement = await Mock.deploy("replacement");
    await factory.connect(owner).updateTokenAddress(1, await replacement.getAddress());
    await factory.connect(owner).createWallet(ethers.id("new-usdm"), other.address, 1);
    const next = await ethers.getContractAt(
      "SentryWallet",
      await factory.walletOfIdentity(ethers.id("new-usdm")),
    );

    expect(await wallet.tokenAddress()).to.equal(await usdm.getAddress());
    expect(await next.tokenAddress()).to.equal(await replacement.getAddress());
  });

  it("rejects duplicate identities and user keys", async function () {
    const { factory, owner, identityHash, user, other } = await loadFixture(deploySystem);
    await expect(
      factory.connect(owner).createWallet(identityHash, other.address, 1),
    ).to.be.revertedWithCustomError(factory, "IdentityAlreadyRegistered");
    await expect(
      factory.connect(owner).createWallet(ethers.id("duplicate-user"), user.address, 1),
    ).to.be.revertedWithCustomError(factory, "OwnerAlreadyRegistered");
  });

  it("rejects invalid admin token updates", async function () {
    const { factory, owner } = await loadFixture(deploySystem);
    await expect(
      factory.connect(owner).updateTokenAddress(0, owner.address),
    ).to.be.revertedWithCustomError(factory, "InvalidTokenConfig");
    await expect(
      factory.connect(owner).updateTokenAddress(1, ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(factory, "InvalidTokenConfig");
  });
});
