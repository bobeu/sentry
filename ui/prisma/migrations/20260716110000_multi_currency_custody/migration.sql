-- Prompt 10: immutable per-wallet currency and manager-controlled withdrawals.

CREATE TYPE "WithdrawalStatus" AS ENUM ('pending', 'submitted', 'succeeded', 'failed');

ALTER TABLE "User" ADD COLUMN "withdrawalAddress" TEXT;
ALTER TABLE "Wallet" ADD COLUMN "walletCurrency" TEXT NOT NULL DEFAULT 'USDm';

DROP TABLE IF EXISTS "PaymentConfig";

CREATE TABLE "PaymentCurrencyConfig" (
    "currency" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "tokenAddress" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentCurrencyConfig_pkey" PRIMARY KEY ("currency")
);

INSERT INTO "PaymentCurrencyConfig" ("currency", "enabled", "tokenAddress", "updatedAt")
VALUES
    ('CELO', true, NULL, CURRENT_TIMESTAMP),
    ('USDm', true, NULL, CURRENT_TIMESTAMP),
    ('USDC', true, NULL, CURRENT_TIMESTAMP),
    ('USDT', true, NULL, CURRENT_TIMESTAMP);

CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "currency" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "transactionHash" TEXT,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'pending',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Withdrawal_userId_createdAt_idx" ON "Withdrawal"("userId", "createdAt");
CREATE INDEX "Withdrawal_status_idx" ON "Withdrawal"("status");

ALTER TABLE "Withdrawal"
ADD CONSTRAINT "Withdrawal_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Withdrawal"
ADD CONSTRAINT "Withdrawal_walletId_fkey"
FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
