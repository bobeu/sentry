import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deploySystem } from "./helpers";

describe("Multi-currency custody integration", function () {
  it("creates, funds, settles, and withdraws a manager-controlled wallet", async function () {
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
      other,
      usdm,
    } = await loadFixture(deploySystem);

    expect(await factory.walletFromIdentity(identityHash)).to.equal(walletAddress);
    expect(await factory.walletFromUser(user.address)).to.equal(walletAddress);
    expect(await wallet.manager()).to.equal(await manager.getAddress());
    expect(await wallet.paymentCurrency()).to.equal(1);

    await manager.connect(owner).registerEmployment(user.address, walletAddress);
    await manager.connect(operator).setWithdrawalDestination(user.address, other.address);
    await usdm.mint(walletAddress, 10_000);

    await manager.connect(operator).settleAndWithdraw(
      user.address,
      ethers.id("integration-settlement"),
      2_000,
      20,
      ethers.id("integration-withdrawal"),
      5_000,
    );

    expect(await usdm.balanceOf(treasury.address)).to.equal(2_020);
    expect(await usdm.balanceOf(other.address)).to.equal(5_000);
    expect(await wallet.balance()).to.equal(2_980);
  });
});
