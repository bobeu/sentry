import { expect } from "chai";
import { ethers } from "hardhat";

describe("EmploymentContract", function () {
  it("accepts deposits and reports balance", async function () {
    const [user] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("EmploymentContract");
    const contract = await Factory.deploy();
    await contract.waitForDeployment();

    await contract.connect(user).deposit({ value: ethers.parseEther("1") });
    const balance = await contract.balanceOf(user.address);
    expect(balance).to.equal(ethers.parseEther("1"));
  });

  it("allows withdraw", async function () {
    const [user] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("EmploymentContract");
    const contract = await Factory.deploy();
    await contract.waitForDeployment();

    await contract.connect(user).deposit({ value: ethers.parseEther("2") });
    await contract.connect(user).withdraw(ethers.parseEther("1"));
    const balance = await contract.balanceOf(user.address);
    expect(balance).to.equal(ethers.parseEther("1"));
  });
});
