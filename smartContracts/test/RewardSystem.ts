import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

async function deployRewardSystem() {
  const [owner, operator, employer, member, other] = await ethers.getSigners();

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const usdm = await MockERC20.deploy("USDm");
  const usdc = await MockERC20.deploy("USDC");
  const usdt = await MockERC20.deploy("USDT");

  const RewardFactory = await ethers.getContractFactory("RewardFactory");
  const factory = await RewardFactory.deploy(
    owner.address,
    operator.address,
    await usdm.getAddress(),
    await usdc.getAddress(),
    await usdt.getAddress(),
  );

  const accountKey = ethers.id("telegram-group:12345");
  await factory.connect(owner).createAccount(accountKey, employer.address);
  const accountAddress = await factory.accountOfKey(accountKey);
  const account = await ethers.getContractAt("RewardAccount", accountAddress);

  return {
    owner,
    operator,
    employer,
    member,
    other,
    usdm,
    usdc,
    usdt,
    factory,
    account,
    accountAddress,
    accountKey,
  };
}

describe("RewardFactory + RewardAccount (multi-currency)", function () {
  it("creates one active multi-currency account per key", async function () {
    const { factory, account, accountKey, operator, employer, usdm, usdc, usdt } =
      await loadFixture(deployRewardSystem);
    expect(await factory.accountOfKey(accountKey)).to.equal(await account.getAddress());
    expect(await account.operator()).to.equal(operator.address);
    expect(await account.employer()).to.equal(employer.address);
    expect(await account.status()).to.equal(1); // Active
    expect(await account.usdmToken()).to.equal(await usdm.getAddress());
    expect(await account.usdcToken()).to.equal(await usdc.getAddress());
    expect(await account.usdtToken()).to.equal(await usdt.getAddress());
    expect(await factory.accountVersion()).to.equal(2);
  });

  it("rejects duplicate account keys and zero employer", async function () {
    const { factory, owner, accountKey, employer } = await loadFixture(deployRewardSystem);
    await expect(
      factory.connect(owner).createAccount(accountKey, employer.address),
    ).to.be.revertedWithCustomError(factory, "AccountAlreadyExists");
    await expect(
      factory.connect(owner).createAccount(ethers.id("new-key"), ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(factory, "ZeroAddress");
  });

  it("holds multiple currencies and pays out each via factory operator", async function () {
    const { account, factory, usdm, usdc, employer, operator, member, other, accountKey, owner } =
      await loadFixture(deployRewardSystem);
    const accountAddress = await account.getAddress();

    await usdm.mint(employer.address, 1_000);
    await usdm.connect(employer).transfer(accountAddress, 500);
    await usdc.mint(accountAddress, 300);
    await owner.sendTransaction({ to: accountAddress, value: ethers.parseEther("1") });

    const bals = await account.balances();
    expect(bals[0]).to.equal(ethers.parseEther("1"));
    expect(bals[1]).to.equal(500);
    expect(bals[2]).to.equal(300);
    expect(bals[3]).to.equal(0);

    const payoutId = ethers.id("payout-1");

    await expect(
      account.connect(operator).payout(member.address, 100, payoutId, 1),
    ).to.be.revertedWithCustomError(account, "UnauthorizedFactory");

    await expect(
      factory.connect(other).payout(accountKey, member.address, 100, payoutId, 1),
    ).to.be.revertedWithCustomError(factory, "UnauthorizedOperator");

    await expect(
      factory.connect(operator).payout(accountKey, member.address, 100, payoutId, 1),
    )
      .to.emit(account, "RewardPaid")
      .withArgs(member.address, 1, 100, payoutId);

    expect(await usdm.balanceOf(member.address)).to.equal(100);
    expect(await account.balance(1)).to.equal(400);

    await factory
      .connect(operator)
      .payout(accountKey, member.address, 50, ethers.id("usdc-1"), 2);
    expect(await usdc.balanceOf(member.address)).to.equal(50);

    await factory
      .connect(operator)
      .payout(accountKey, member.address, ethers.parseEther("0.25"), ethers.id("celo-1"), 0);
    expect(await account.balance(0)).to.equal(ethers.parseEther("0.75"));

    await expect(
      factory.connect(operator).payout(accountKey, member.address, 50, payoutId, 1),
    ).to.be.revertedWithCustomError(account, "PayoutAlreadyProcessed");
  });

  it("operator and owner can pause/resume via factory", async function () {
    const { account, factory, owner, operator, usdm, member, accountKey } =
      await loadFixture(deployRewardSystem);
    await usdm.mint(await account.getAddress(), 200);

    await factory.connect(operator).pauseAccountByOperator(accountKey);
    expect(await account.status()).to.equal(2);
    await expect(
      factory.connect(operator).payout(accountKey, member.address, 10, ethers.id("x"), 1),
    ).to.be.revertedWithCustomError(account, "InvalidAccountStatus");

    await factory.connect(owner).resumeAccount(accountKey);
    expect(await account.status()).to.equal(1);
    await factory.connect(operator).payout(accountKey, member.address, 10, ethers.id("y"), 1);
    expect(await usdm.balanceOf(member.address)).to.equal(10);
  });

  it("withdrawToEmployer leaves pending reserves and sends surplus", async function () {
    const { factory, account, operator, employer, other, usdm, usdc, accountKey, owner } =
      await loadFixture(deployRewardSystem);
    const accountAddress = await account.getAddress();
    await usdm.mint(accountAddress, 250);
    await usdc.mint(accountAddress, 100);
    await owner.sendTransaction({ to: accountAddress, value: ethers.parseEther("2") });

    await expect(
      account.connect(employer).withdrawAllToEmployer(0, 0, 0, 0),
    ).to.be.revertedWithCustomError(account, "UnauthorizedFactory");
    await expect(
      factory.connect(other).withdrawToEmployer(accountKey, 0, 0, 0, 0),
    ).to.be.revertedWithCustomError(factory, "UnauthorizedOperator");

    // pending USDm=100 must remain; withdraw surplus 150 USDm + all USDC + all CELO
    const beforeUsdm = await usdm.balanceOf(employer.address);
    const beforeUsdc = await usdc.balanceOf(employer.address);
    const beforeCelo = await ethers.provider.getBalance(employer.address);

    await factory
      .connect(operator)
      .withdrawToEmployer(accountKey, 0, 100, 0, 0);

    expect(await usdm.balanceOf(employer.address)).to.equal(beforeUsdm + 150n);
    expect(await usdc.balanceOf(employer.address)).to.equal(beforeUsdc + 100n);
    expect(await account.balance(1)).to.equal(100);
    expect(await account.balance(2)).to.equal(0);
    expect(await account.balance(0)).to.equal(0);
    expect(await ethers.provider.getBalance(employer.address)).to.be.gt(beforeCelo);

    // Cannot reserve more than balance
    await usdm.mint(accountAddress, 50);
    await expect(
      factory.connect(operator).withdrawToEmployer(accountKey, 0, 200, 0, 0),
    ).to.be.revertedWithCustomError(account, "InsufficientReserve");
  });

  it("archives account and blocks further payouts and withdraw", async function () {
    const { factory, owner, operator, account, accountKey, usdm, member } =
      await loadFixture(deployRewardSystem);
    await usdm.mint(await account.getAddress(), 50);
    await factory.connect(owner).archiveAccount(accountKey);
    expect(await account.status()).to.equal(3);
    await expect(
      factory
        .connect(operator)
        .payout(accountKey, member.address, 1, ethers.id("archived"), 1),
    ).to.be.revertedWithCustomError(account, "InvalidAccountStatus");
    await expect(
      factory.connect(operator).withdrawToEmployer(accountKey, 0, 0, 0, 0),
    ).to.be.revertedWithCustomError(account, "InvalidAccountStatus");
  });

  it("rotates account operator mirror via factory; payout still uses factory operator", async function () {
    const { factory, owner, account, accountKey, other, operator, usdm, member } =
      await loadFixture(deployRewardSystem);
    await factory.connect(owner).setAccountOperator(accountKey, other.address);
    expect(await account.operator()).to.equal(other.address);
    await usdm.mint(await account.getAddress(), 30);
    await factory
      .connect(operator)
      .payout(accountKey, member.address, 5, ethers.id("rot"), 1);
    expect(await usdm.balanceOf(member.address)).to.equal(5);
  });

  it("rejects zero-key and zero-amount payouts", async function () {
    const { factory, owner, operator, member, usdm, accountKey, employer } =
      await loadFixture(deployRewardSystem);
    await expect(
      factory.connect(owner).createAccount(ethers.ZeroHash, employer.address),
    ).to.be.revertedWithCustomError(factory, "InvalidAccountKey");
    await usdm.mint(await factory.accountOfKey(accountKey), 10);
    await expect(
      factory
        .connect(operator)
        .payout(accountKey, member.address, 0, ethers.id("zero"), 1),
    ).to.be.revertedWithCustomError(
      await ethers.getContractAt("RewardAccount", await factory.accountOfKey(accountKey)),
      "InvalidAmount",
    );
  });

  it("rejects payout when currency is disabled on factory", async function () {
    const { factory, owner, operator, member, usdm, accountKey } =
      await loadFixture(deployRewardSystem);
    await usdm.mint(await factory.accountOfKey(accountKey), 10);
    await factory.connect(owner).setCurrencyEnabled(1, false);
    await expect(
      factory
        .connect(operator)
        .payout(accountKey, member.address, 1, ethers.id("disabled"), 1),
    ).to.be.revertedWithCustomError(factory, "CurrencyDisabled");
  });
});
