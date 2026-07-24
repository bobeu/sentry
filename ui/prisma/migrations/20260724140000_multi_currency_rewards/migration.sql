-- Multi-currency reward pending + campaign currency stamps
CREATE TABLE IF NOT EXISTS "MemberRewardBalance" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "pendingReward" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "lifetimeRewarded" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemberRewardBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MemberRewardBalance_groupId_telegramUserId_currency_key"
  ON "MemberRewardBalance"("groupId", "telegramUserId", "currency");
CREATE INDEX IF NOT EXISTS "MemberRewardBalance_groupId_currency_idx"
  ON "MemberRewardBalance"("groupId", "currency");
CREATE INDEX IF NOT EXISTS "MemberRewardBalance_groupId_telegramUserId_idx"
  ON "MemberRewardBalance"("groupId", "telegramUserId");

DO $$ BEGIN
  ALTER TABLE "MemberRewardBalance"
    ADD CONSTRAINT "MemberRewardBalance_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "TelegramGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "EngagementActivity"
  ADD COLUMN IF NOT EXISTS "rewardCurrency" TEXT NOT NULL DEFAULT 'USDm';
ALTER TABLE "EngagementActivity"
  ADD COLUMN IF NOT EXISTS "rewardAmountPerPoint" DECIMAL(18,8);

ALTER TABLE "ActivitySubmission"
  ADD COLUMN IF NOT EXISTS "currency" TEXT;
ALTER TABLE "ActivitySubmission"
  ADD COLUMN IF NOT EXISTS "cashAmount" DECIMAL(18,8);

-- Migrate scalar MemberPoints pending into per-currency rows
INSERT INTO "MemberRewardBalance" ("id", "groupId", "telegramUserId", "currency", "pendingReward", "lifetimeRewarded", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  mp."groupId",
  mp."telegramUserId",
  COALESCE(
    NULLIF(ra."currency", 'MULTI'),
    NULLIF(gs."rewardCurrency", ''),
    'USDm'
  ),
  mp."pendingReward",
  mp."lifetimeRewarded",
  NOW(),
  NOW()
FROM "MemberPoints" mp
LEFT JOIN "RewardAccount" ra ON ra."groupId" = mp."groupId"
LEFT JOIN "GroupSettings" gs ON gs."groupId" = mp."groupId"
WHERE mp."pendingReward" > 0 OR mp."lifetimeRewarded" > 0
ON CONFLICT ("groupId", "telegramUserId", "currency") DO UPDATE SET
  "pendingReward" = EXCLUDED."pendingReward",
  "lifetimeRewarded" = EXCLUDED."lifetimeRewarded",
  "updatedAt" = NOW();

UPDATE "RewardAccount" SET "currency" = 'MULTI' WHERE "currency" IS DISTINCT FROM 'MULTI';

UPDATE "EngagementActivity" ea
SET "rewardCurrency" = COALESCE(NULLIF(gs."rewardCurrency", ''), 'USDm')
FROM "GroupSettings" gs
WHERE gs."groupId" = ea."groupId";
