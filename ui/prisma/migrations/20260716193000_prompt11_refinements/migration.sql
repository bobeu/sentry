-- Prompt 11: wallet lifecycle, pending withdrawal confirmation, settlement fee buffer config.

ALTER TABLE "User" ADD COLUMN "pendingWithdrawalAddress" TEXT;
ALTER TABLE "Wallet" ADD COLUMN "walletStatus" TEXT NOT NULL DEFAULT 'Provisioning';
