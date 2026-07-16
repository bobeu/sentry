import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deploySystem } from "./helpers";

describe("Sentry contracts integration", function () {
  it("runs the complete employment and settlement lifecycle", async function () {
    const {
      factory,
      manager,
      wallet,
      walletAddress,
      identityHash,
      owner,
      operator,
      treasury,
      user,
      usdm,
    } = await loadFixture(deploySystem);

    // User and identity resolve to the single persisted wallet.
    expect(await factory.walletFromIdentity(identityHash)).to.equal(walletAddress);
    expect(await factory.walletFromOwner(user.address)).to.equal(walletAddress);
    expect(await wallet.owner()).to.equal(user.address);
    expect(await wallet.manager()).to.equal(await manager.getAddress());

    // Employment starts only after the manager validates the wallet.
    await manager.connect(owner).registerEmployment(user.address, walletAddress);
    expect(await manager.employmentStatus(user.address)).to.equal(1);

    // User prepays directly into the wallet.
    const funded = ethers.parseEther("10");
    await usdm.mint(walletAddress, funded);
    expect(await wallet.erc20Balance(1)).to.equal(funded);

    // Backend-simulated outstanding work settles in one batch.
    const serviceAmount = ethers.parseEther("2");
    const settlementFee = ethers.parseEther("0.02");
    const settlementId = ethers.id("integration-settlement");
    await manager
      .connect(operator)
      .chargeSettlement(user.address, settlementId, serviceAmount, settlementFee);

    expect(await usdm.balanceOf(treasury.address)).to.equal(
      serviceAmount + settlementFee,
    );
    expect(await usdm.balanceOf(walletAddress)).to.equal(
      funded - serviceAmount - settlementFee,
    );

    // The same batch can never be charged twice.
    await expect(
      manager
        .connect(operator)
        .chargeSettlement(user.address, settlementId, serviceAmount, settlementFee),
    ).to.be.revertedWithCustomError(manager, "AlreadySettled");
  });

  it("settles native CELO end to end", async function () {
    const { manager, walletAddress, owner, operator, treasury, user, other } =
      await loadFixture(deploySystem);
    const funded = ethers.parseEther("3");
    const service = ethers.parseEther("1");
    const fee = ethers.parseEther("0.01");

    await manager.connect(owner).registerEmployment(user.address, walletAddress);
    await manager.connect(owner).setPaymentToken(0);
    await other.sendTransaction({ to: walletAddress, value: funded });

    await expect(() =>
      manager
        .connect(operator)
        .chargeSettlement(user.address, ethers.id("native"), service, fee),
    ).to.changeEtherBalances(
      [walletAddress, treasury],
      [-(service + fee), service + fee],
    );
  });
});
