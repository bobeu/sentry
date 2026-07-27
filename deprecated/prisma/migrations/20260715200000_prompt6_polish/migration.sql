-- Prompt 6: payment currency, charge currency, wallet cache, telegram bot status

ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "balanceCachedAt" TIMESTAMP(3);
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "identityHash" TEXT;

ALTER TABLE "TelegramGroup" ADD COLUMN IF NOT EXISTS "botStatus" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "TelegramGroup" ADD COLUMN IF NOT EXISTS "botCanDelete" BOOLEAN;
ALTER TABLE "TelegramGroup" ADD COLUMN IF NOT EXISTS "lastBotEventAt" TIMESTAMP(3);

ALTER TABLE "ChargeRecord" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USDm';
ALTER TABLE "ChargeRecord" ADD COLUMN IF NOT EXISTS "failureReason" TEXT;

CREATE INDEX IF NOT EXISTS "ChargeRecord_status_idx" ON "ChargeRecord"("status");

CREATE TABLE IF NOT EXISTS "PaymentConfig" (
    "id" TEXT NOT NULL,
    "activeCurrency" TEXT NOT NULL DEFAULT 'USDm',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PaymentConfig" ("id", "activeCurrency", "updatedAt")
VALUES ('global', 'USDm', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
