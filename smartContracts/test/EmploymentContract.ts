import { expect } from "chai";
import { ethers } from "hardhat";

describe("EmploymentContract", function () {
  async function deploy() {
    const [owner, operator, user] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("EmploymentContract");
    const contract = await Factory.deploy(
      owner.address,
      operator.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
    );
    await contract.waitForDeployment();
    return { contract, owner, operator, user };
  }

  it("accepts native deposits when CELO is active", async function () {
    const { contract, user } = await deploy();
    await contract.connect(user).depositNative({ value: ethers.parseEther("1") });
    expect(await contract.balanceOf(user.address)).to.equal(ethers.parseEther("1"));
  });

  it("allows operator to charge and exhaust with replay protection", async function () {
    const { contract, operator, user } = await deploy();
    await contract.connect(user).depositNative({ value: ethers.parseEther("1") });
    const actionId = ethers.id("action-1");
    await contract
      .connect(operator)
      .charge(user.address, ethers.parseEther("1"), actionId);
    expect(await contract.balanceOf(user.address)).to.equal(0n);
    expect(await contract.isPaused(user.address)).to.equal(true);
    await expect(
      contract.connect(operator).charge(user.address, ethers.parseEther("0.01"), actionId),
    ).to.be.revertedWithCustomError(contract, "AlreadyCharged");
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
});
