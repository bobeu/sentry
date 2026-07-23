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
  await factory.connect(owner).createAccount(accountKey, 1); // USDm
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

describe("RewardFactory + RewardAccount", function () {
  it("creates one active USDm account per key with Sentry as operator", async function () {
    const { factory, account, accountKey, operator } = await loadFixture(deployRewardSystem);
    expect(await factory.accountOfKey(accountKey)).to.equal(await account.getAddress());
    expect(await account.operator()).to.equal(operator.address);
    expect(await account.status()).to.equal(1); // Active
    expect(await account.rewardCurrency()).to.equal(1); // USDm
  });

  it("rejects duplicate account keys", async function () {
    const { factory, owner, accountKey } = await loadFixture(deployRewardSystem);
    await expect(factory.connect(owner).createAccount(accountKey, 1)).to.be.revertedWithCustomError(
      factory,
      "AccountAlreadyExists",
    );
  });

  it("lets anyone fund; only operator can payout with replay protection", async function () {
    const { account, usdm, employer, operator, member, other } =
      await loadFixture(deployRewardSystem);
    const accountAddress = await account.getAddress();

    await usdm.mint(employer.address, 1_000);
    await usdm.connect(employer).transfer(accountAddress, 500);
    expect(await account.balance()).to.equal(500);

    const payoutId = ethers.id("payout-1");
    await expect(
      account.connect(other).payout(member.address, 100, payoutId),
    ).to.be.revertedWithCustomError(account, "UnauthorizedOperator");

    await expect(account.connect(operator).payout(member.address, 100, payoutId))
      .to.emit(account, "RewardPaid")
      .withArgs(member.address, 1, 100, payoutId);

    expect(await usdm.balanceOf(member.address)).to.equal(100);
    expect(await account.balance()).to.equal(400);

    await expect(
      account.connect(operator).payout(member.address, 50, payoutId),
    ).to.be.revertedWithCustomError(account, "PayoutAlreadyProcessed");
  });

  it("supports CELO reward accounts", async function () {
    const { factory, owner, operator, member } = await loadFixture(deployRewardSystem);
    const key = ethers.id("telegram-group:celo");
    await factory.connect(owner).createAccount(key, 0);
    const accountAddress = await factory.accountOfKey(key);
    const account = await ethers.getContractAt("RewardAccount", accountAddress);

    await owner.sendTransaction({ to: accountAddress, value: ethers.parseEther("1") });
    expect(await account.balance()).to.equal(ethers.parseEther("1"));

    const payoutId = ethers.id("celo-payout");
    await account.connect(operator).payout(member.address, ethers.parseEther("0.25"), payoutId);
    expect(await account.balance()).to.equal(ethers.parseEther("0.75"));
  });

  it("operator and factory can pause/resume payouts", async function () {
    const { account, factory, owner, operator, usdm, member, accountKey } =
      await loadFixture(deployRewardSystem);
    await usdm.mint(await account.getAddress(), 200);

    await account.connect(operator).pauseByOperator();
    expect(await account.status()).to.equal(2); // Paused
    await expect(
      account.connect(operator).payout(member.address, 10, ethers.id("x")),
    ).to.be.revertedWithCustomError(account, "InvalidAccountStatus");

    await factory.connect(owner).resumeAccount(accountKey);
    expect(await account.status()).to.equal(1);
    await account.connect(operator).payout(member.address, 10, ethers.id("y"));
    expect(await usdm.balanceOf(member.address)).to.equal(10);
  });

  it("archives account and blocks further payouts", async function () {
    const { factory, owner, operator, account, accountKey, usdm, member } =
      await loadFixture(deployRewardSystem);
    await usdm.mint(await account.getAddress(), 50);
    await factory.connect(owner).archiveAccount(accountKey);
    expect(await account.status()).to.equal(3); // Archived
    await expect(
      account.connect(operator).payout(member.address, 1, ethers.id("archived")),
    ).to.be.revertedWithCustomError(account, "InvalidAccountStatus");
  });

  it("rotates account operator via factory", async function () {
    const { factory, owner, account, accountKey, other, usdm, member } =
      await loadFixture(deployRewardSystem);
    await factory.connect(owner).setAccountOperator(accountKey, other.address);
    expect(await account.operator()).to.equal(other.address);
    await usdm.mint(await account.getAddress(), 30);
    await account.connect(other).payout(member.address, 5, ethers.id("rot"));
    expect(await usdm.balanceOf(member.address)).to.equal(5);
  });

  it("rejects zero-key and zero-amount payouts", async function () {
    const { factory, owner, account, operator, member, usdm } =
      await loadFixture(deployRewardSystem);
    await expect(
      factory.connect(owner).createAccount(ethers.ZeroHash, 1),
    ).to.be.revertedWithCustomError(factory, "InvalidAccountKey");
    await usdm.mint(await account.getAddress(), 10);
    await expect(
      account.connect(operator).payout(member.address, 0, ethers.id("zero")),
    ).to.be.revertedWithCustomError(account, "InvalidAmount");
  });

  it("does not touch EmploymentManager / SentryWallet factories", async function () {
    const { factory } = await loadFixture(deployRewardSystem);
    expect(await factory.accountVersion()).to.equal(1);
    expect(await factory.operator()).to.not.equal(ethers.ZeroAddress);
  });
});
