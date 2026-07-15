import { expect } from "chai";
import { ethers } from "hardhat";

describe("EmploymentContract", function () {
  async function deploy() {
    const [owner, operator, user, funder] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockERC20");
    const usdm = await Mock.deploy("USDm");
    const usdc = await Mock.deploy("USDC");
    const usdt = await Mock.deploy("USDT");
    const Factory = await ethers.getContractFactory("EmploymentContract");
    const contract = await Factory.deploy(
      owner.address,
      operator.address,
      owner.address,
      await usdm.getAddress(),
      await usdc.getAddress(),
      await usdt.getAddress(),
    );
    await contract.waitForDeployment();
    return { contract, owner, operator, user, funder, usdm, usdc, usdt };
  }

  it("accepts native deposits when CELO is active", async function () {
    const { contract, user } = await deploy();
    await contract.connect(user).depositNative({ value: ethers.parseEther("1") });
    expect(await contract.balanceOf(user.address)).to.equal(ethers.parseEther("1"));
  });

  it("accepts depositNativeFor (web deposit to employment wallet)", async function () {
    const { contract, user, funder } = await deploy();
    const employmentWallet = user.address;
    await contract
      .connect(funder)
      .depositNativeFor(employmentWallet, { value: ethers.parseEther("2") });
    expect(await contract.balanceOf(employmentWallet)).to.equal(ethers.parseEther("2"));
  });

  it("accepts supported stablecoin deposits", async function () {
    const { contract, user, usdm, owner } = await deploy();
    await contract.connect(owner).setActivePaymentToken(1);
    await usdm.mint(user.address, ethers.parseEther("10"));
    await usdm.connect(user).approve(await contract.getAddress(), ethers.parseEther("5"));
    await contract.connect(user).depositERC20(ethers.parseEther("5"));
    expect(await contract.balanceOf(user.address)).to.equal(ethers.parseEther("5"));
  });

  it("accepts depositERC20For (web deposit stablecoin to employment wallet)", async function () {
    const { contract, user, funder, usdm, owner } = await deploy();
    await contract.connect(owner).setActivePaymentToken(1);
    await usdm.mint(funder.address, ethers.parseEther("10"));
    await usdm.connect(funder).approve(await contract.getAddress(), ethers.parseEther("3"));
    await contract.connect(funder).depositERC20For(user.address, ethers.parseEther("3"));
    expect(await contract.balanceOf(user.address)).to.equal(ethers.parseEther("3"));
  });

  it("rejects ERC20 deposit when CELO is active", async function () {
    const { contract, user, usdm } = await deploy();
    await usdm.mint(user.address, ethers.parseEther("1"));
    await usdm.connect(user).approve(await contract.getAddress(), ethers.parseEther("1"));
    await expect(contract.connect(user).depositERC20(ethers.parseEther("1"))).to.be.revertedWithCustomError(
      contract,
      "WrongDepositMethod",
    );
  });

  it("rejects native deposit when stablecoin is active", async function () {
    const { contract, user, owner } = await deploy();
    await contract.connect(owner).setActivePaymentToken(1);
    await expect(
      contract.connect(user).depositNative({ value: ethers.parseEther("1") }),
    ).to.be.revertedWithCustomError(contract, "WrongDepositMethod");
  });

  it("allows operator to charge and exhaust with replay protection", async function () {
    const { contract, operator, user } = await deploy();
    await contract.connect(user).depositNative({ value: ethers.parseEther("1") });
    const actionId = ethers.id("action-1");
    await contract.connect(operator).charge(user.address, ethers.parseEther("0.5"), actionId);
    await expect(
      contract.connect(operator).charge(user.address, ethers.parseEther("0.01"), actionId),
    ).to.be.revertedWithCustomError(contract, "AlreadyCharged");
    await contract.connect(operator).charge(user.address, ethers.parseEther("0.5"), ethers.id("action-2"));
    expect(await contract.balanceOf(user.address)).to.equal(0n);
    expect(await contract.isPaused(user.address)).to.equal(true);
  });

  it("rejects unauthorized charge", async function () {
    const { contract, user } = await deploy();
    await contract.connect(user).depositNative({ value: ethers.parseEther("1") });
    await expect(
      contract.connect(user).charge(user.address, ethers.parseEther("0.1"), ethers.id("x")),
    ).to.be.revertedWithCustomError(contract, "Unauthorized");
  });

  it("pause and resume", async function () {
    const { contract, operator, user } = await deploy();
    await contract.connect(user).depositNative({ value: ethers.parseEther("2") });
    await contract.connect(operator).pause(user.address);
    await expect(
      contract.connect(user).withdraw(ethers.parseEther("1")),
    ).to.be.revertedWithCustomError(contract, "AccountPaused");
    await contract.connect(operator).resume(user.address);
    await contract.connect(user).withdraw(ethers.parseEther("1"));
    expect(await contract.balanceOf(user.address)).to.equal(ethers.parseEther("1"));
  });

  it("registers identity hash only (no raw identifiers)", async function () {
    const { contract, operator, user } = await deploy();
    const identityHash = ethers.id("email:alice@example.com");
    await contract.connect(operator).registerIdentity(identityHash, user.address);
    expect(await contract.identityWallet(identityHash)).to.equal(user.address);
  });

  it("emits PaymentCurrencyChanged", async function () {
    const { contract, owner, usdc } = await deploy();
    await expect(contract.connect(owner).setActivePaymentToken(2))
      .to.emit(contract, "PaymentCurrencyChanged")
      .withArgs(2);
    await usdc.mint(owner.address, ethers.parseEther("1"));
    await usdc.connect(owner).approve(await contract.getAddress(), ethers.parseEther("1"));
    await contract.connect(owner).depositERC20(ethers.parseEther("1"));
  });
});
