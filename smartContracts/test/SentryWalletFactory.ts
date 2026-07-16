import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deploySystem } from "./helpers";

describe("SentryWalletFactory", function () {
  it("creates and indexes one wallet", async function () {
    const { factory, identityHash, user, walletAddress } = await loadFixture(
      deploySystem,
    );

    expect(await factory.hasWallet(identityHash)).to.equal(true);
    expect(await factory.walletFromIdentity(identityHash)).to.equal(walletAddress);
    expect(await factory.walletFromOwner(user.address)).to.equal(walletAddress);
    expect(await factory.identityOfWallet(walletAddress)).to.equal(identityHash);
  });

  it("emits WalletCreated with identity, owner, and wallet", async function () {
    const { factory, owner, other } = await loadFixture(deploySystem);
    const identity = ethers.id("email:other@example.com");

    const wallet = await factory
      .connect(owner)
      .createWallet.staticCall(identity, other.address);
    await expect(factory.connect(owner).createWallet(identity, other.address))
      .to.emit(factory, "WalletCreated")
      .withArgs(identity, other.address, wallet);
  });

  it("rejects a duplicate identity", async function () {
    const { factory, owner, identityHash, other } = await loadFixture(deploySystem);

    await expect(
      factory.connect(owner).createWallet(identityHash, other.address),
    ).to.be.revertedWithCustomError(factory, "IdentityAlreadyRegistered");
  });

  it("rejects a duplicate owner", async function () {
    const { factory, owner, user } = await loadFixture(deploySystem);

    await expect(
      factory
        .connect(owner)
        .createWallet(ethers.id("email:second@example.com"), user.address),
    ).to.be.revertedWithCustomError(factory, "OwnerAlreadyRegistered");
  });

  it("rejects unauthorized wallet creation", async function () {
    const { factory, other } = await loadFixture(deploySystem);

    await expect(
      factory
        .connect(other)
        .createWallet(ethers.id("email:other@example.com"), other.address),
    )
      .to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount")
      .withArgs(other.address);
  });

  it("updates supported tokens for future wallets and emits an event", async function () {
    const { factory, owner, other } = await loadFixture(deploySystem);
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const newUsdm = await MockERC20.deploy("newUSDm");
    const newUsdc = await MockERC20.deploy("newUSDC");
    const newUsdt = await MockERC20.deploy("newUSDT");

    await expect(
      factory
        .connect(owner)
        .updateSupportedTokens(
          await newUsdm.getAddress(),
          await newUsdc.getAddress(),
          await newUsdt.getAddress(),
        ),
    )
      .to.emit(factory, "SupportedTokensUpdated")
      .withArgs(
        await newUsdm.getAddress(),
        await newUsdc.getAddress(),
        await newUsdt.getAddress(),
      );

    const identity = ethers.id("email:new@example.com");
    await factory.connect(owner).createWallet(identity, other.address);
    const wallet = await ethers.getContractAt(
      "SentryWallet",
      await factory.walletOfIdentity(identity),
    );
    expect(await wallet.tokenAddress(1)).to.equal(await newUsdm.getAddress());
    expect(await wallet.tokenAddress(2)).to.equal(await newUsdc.getAddress());
    expect(await wallet.tokenAddress(3)).to.equal(await newUsdt.getAddress());
  });

  it("rejects zero owner, identity, manager, and token addresses", async function () {
    const { factory, owner, manager, usdm, usdc, usdt } = await loadFixture(deploySystem);

    await expect(
      factory.connect(owner).createWallet(ethers.ZeroHash, owner.address),
    ).to.be.revertedWithCustomError(factory, "InvalidIdentity");
    await expect(
      factory.connect(owner).createWallet(ethers.id("zero-owner"), ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(factory, "ZeroAddress");
    await expect(
      factory
        .connect(owner)
        .updateSupportedTokens(
          ethers.ZeroAddress,
          await usdc.getAddress(),
          await usdt.getAddress(),
        ),
    ).to.be.revertedWithCustomError(factory, "ZeroAddress");

    const Factory = await ethers.getContractFactory("SentryWalletFactory");
    await expect(
      Factory.deploy(
        owner.address,
        ethers.ZeroAddress,
        await usdm.getAddress(),
        await usdc.getAddress(),
        await usdt.getAddress(),
      ),
    ).to.be.revertedWithCustomError(Factory, "ZeroAddress");
    expect(await manager.getAddress()).to.not.equal(ethers.ZeroAddress);
  });

  it("supports secure ownership transfer", async function () {
    const { factory, owner, other } = await loadFixture(deploySystem);
    await expect(factory.connect(owner).transferOwnership(other.address))
      .to.emit(factory, "OwnershipTransferred")
      .withArgs(owner.address, other.address);

    await expect(
      factory
        .connect(owner)
        .createWallet(ethers.id("email:old-owner@example.com"), owner.address),
    )
      .to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount")
      .withArgs(owner.address);
  });
});
