-- Prompt 5: ChargeRecord for pay-per-completed-work billing

CREATE TYPE "ChargeStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

CREATE TABLE IF NOT EXISTS "ChargeRecord" (
    "id" TEXT NOT NULL,
    "actionRecordId" TEXT NOT NULL,
    "amount" DECIMAL(36, 18) NOT NULL,
    "status" "ChargeStatus" NOT NULL DEFAULT 'pending',
    "transactionHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChargeRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChargeRecord_actionRecordId_key" ON "ChargeRecord"("actionRecordId");
CREATE INDEX IF NOT EXISTS "ChargeRecord_createdAt_idx" ON "ChargeRecord"("createdAt");

ALTER TABLE "ChargeRecord" DROP CONSTRAINT IF EXISTS "ChargeRecord_actionRecordId_fkey";
ALTER TABLE "ChargeRecord" ADD CONSTRAINT "ChargeRecord_actionRecordId_fkey" FOREIGN KEY ("actionRecordId") REFERENCES "ActionRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
