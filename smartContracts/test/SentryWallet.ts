import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deploySystem } from "./helpers";

describe("SentryWallet", function () {
  it("receives native CELO and reports its balance", async function () {
    const { wallet, walletAddress, other } = await loadFixture(deploySystem);
    const amount = ethers.parseEther("2");

    await expect(other.sendTransaction({ to: walletAddress, value: amount }))
      .to.emit(wallet, "NativeReceived")
      .withArgs(other.address, amount);

    expect(await wallet.nativeBalance()).to.equal(amount);
  });

  it("receives supported ERC20 tokens and reports each balance", async function () {
    const { wallet, walletAddress, usdm, usdc, usdt } = await loadFixture(deploySystem);
    const amount = ethers.parseEther("3");

    for (const [index, token] of [usdm, usdc, usdt].entries()) {
      await token.mint(walletAddress, amount);
      expect(await wallet.erc20Balance(index + 1)).to.equal(amount);
    }
  });

  it("allows the owner to withdraw native CELO", async function () {
    const { wallet, walletAddress, user, other } = await loadFixture(deploySystem);
    const amount = ethers.parseEther("1");
    await other.sendTransaction({ to: walletAddress, value: amount });

    await expect(wallet.connect(user).withdrawNative(amount))
      .to.emit(wallet, "Withdrawal")
      .withArgs(user.address, 0, amount);
    expect(await wallet.nativeBalance()).to.equal(0);
  });

  it("allows the owner to withdraw ERC20 tokens using SafeERC20", async function () {
    const { wallet, walletAddress, user, usdm } = await loadFixture(deploySystem);
    const amount = ethers.parseEther("4");
    await usdm.mint(walletAddress, amount);

    await expect(wallet.connect(user).withdrawERC20(1, amount))
      .to.emit(wallet, "Withdrawal")
      .withArgs(user.address, 1, amount);
    expect(await usdm.balanceOf(user.address)).to.equal(amount);
  });

  it("rejects unauthorized native and ERC20 withdrawals", async function () {
    const { wallet, other } = await loadFixture(deploySystem);

    await expect(wallet.connect(other).withdrawNative(1))
      .to.be.revertedWithCustomError(wallet, "OwnableUnauthorizedAccount")
      .withArgs(other.address);
    await expect(wallet.connect(other).withdrawERC20(1, 1))
      .to.be.revertedWithCustomError(wallet, "OwnableUnauthorizedAccount")
      .withArgs(other.address);
  });

  it("executes a manager-authorized settlement", async function () {
    const { manager, wallet, walletAddress, owner, operator, treasury, user, usdm } =
      await loadFixture(deploySystem);
    const service = ethers.parseEther("1");
    const fee = ethers.parseEther("0.01");
    const settlementId = ethers.id("wallet-settlement");

    await manager.connect(owner).registerEmployment(user.address, walletAddress);
    await usdm.mint(walletAddress, service + fee);

    await expect(
      manager
        .connect(operator)
        .chargeSettlement(user.address, settlementId, service, fee),
    )
      .to.emit(wallet, "SettlementExecuted")
      .withArgs(treasury.address, 1, service + fee, settlementId);

    expect(await usdm.balanceOf(treasury.address)).to.equal(service + fee);
  });

  it("rejects settlement execution by anyone except the manager", async function () {
    const { wallet, other, treasury } = await loadFixture(deploySystem);

    await expect(
      wallet.connect(other).executeSettlement(1, treasury.address, 1, ethers.id("x")),
    ).to.be.revertedWithCustomError(wallet, "UnauthorizedManager");
  });

  it("validates EIP-1271 signatures against the wallet owner", async function () {
    const { wallet, user, other } = await loadFixture(deploySystem);
    const message = ethers.toUtf8Bytes("authorize Sentry");
    const digest = ethers.hashMessage(message);
    const validSignature = await user.signMessage(message);
    const invalidSignature = await other.signMessage(message);

    expect(await wallet.isValidSignature(digest, validSignature)).to.equal("0x1626ba7e");
    expect(await wallet.isValidSignature(digest, invalidSignature)).to.equal(
      "0xffffffff",
    );
    expect(await wallet.isValidSignature(digest, "0x1234")).to.equal("0xffffffff");
  });

  it("rejects native token use in ERC20 functions and zero amounts", async function () {
    const { wallet, user } = await loadFixture(deploySystem);

    await expect(wallet.erc20Balance(0)).to.be.revertedWithCustomError(
      wallet,
      "InvalidToken",
    );
    await expect(wallet.connect(user).withdrawNative(0)).to.be.revertedWithCustomError(
      wallet,
      "InvalidAmount",
    );
    await expect(wallet.connect(user).withdrawERC20(1, 0)).to.be.revertedWithCustomError(
      wallet,
      "InvalidAmount",
    );
  });

  it("keeps owner withdrawals available while EmploymentManager is paused", async function () {
    const { manager, wallet, walletAddress, owner, user, other } = await loadFixture(
      deploySystem,
    );
    const amount = ethers.parseEther("1");
    await manager.connect(owner).pause();
    await other.sendTransaction({ to: walletAddress, value: amount });

    await expect(wallet.connect(user).withdrawNative(amount)).to.not.be.reverted;
  });
});
