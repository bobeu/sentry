-- Settlement billing architecture

CREATE TYPE "SettlementStatus" AS ENUM ('pending', 'submitted', 'succeeded', 'failed');

ALTER TABLE "Employment" ADD COLUMN "outstandingCharges" DECIMAL(36,18) NOT NULL DEFAULT 0;
ALTER TABLE "Employment" ADD COLUMN "lastSettlementAt" TIMESTAMP(3);

ALTER TABLE "ActionRecord" ADD COLUMN "settlementId" TEXT;
CREATE INDEX "ActionRecord_settlementId_idx" ON "ActionRecord"("settlementId");

CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "settlementFee" DECIMAL(36,18) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USDm',
    "actionCount" INTEGER NOT NULL,
    "transactionHash" TEXT,
    "status" "SettlementStatus" NOT NULL DEFAULT 'pending',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Settlement_userId_createdAt_idx" ON "Settlement"("userId", "createdAt");
CREATE INDEX "Settlement_status_idx" ON "Settlement"("status");

ALTER TABLE "ActionRecord" ADD CONSTRAINT "ActionRecord_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
