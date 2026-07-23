-- AlterEnum ActionType
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'engagement_activity';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'reward_payout';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'points_award';

-- CreateEnum
CREATE TYPE "RewardAccountStatus" AS ENUM ('Provisioning', 'Active', 'Paused', 'Archived');
CREATE TYPE "EngagementActivityType" AS ENUM ('poll', 'game', 'learn', 'social', 'comic', 'fun');
CREATE TYPE "EngagementActivityStatus" AS ENUM ('draft', 'active', 'closed', 'cancelled');
CREATE TYPE "RewardLedgerKind" AS ENUM ('award_points', 'reset_points', 'update_points', 'payout', 'payout_failed', 'accumulate');
CREATE TYPE "RewardLedgerStatus" AS ENUM ('pending', 'sent', 'failed', 'cancelled');

-- AlterTable GroupSettings
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "allowGames" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "allowPolls" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "allowFun" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "allowComics" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "allowSocialCampaigns" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "engagementGuidelines" TEXT;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "funPromptIntervalHours" INTEGER NOT NULL DEFAULT 48;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "lastFunPromptAt" TIMESTAMP(3);
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "rewardEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "rewardPaused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "rewardAmountPerPoint" DECIMAL(18,8) NOT NULL DEFAULT 0;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "rewardCurrency" TEXT NOT NULL DEFAULT 'USDm';
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "pointsPerCorrect" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "pointsPerPoll" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "pointsPerGame" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "pointsPerSocial" INTEGER NOT NULL DEFAULT 20;

-- CreateTable RewardAccount
CREATE TABLE IF NOT EXISTS "RewardAccount" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "accountKey" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USDm',
    "status" "RewardAccountStatus" NOT NULL DEFAULT 'Provisioning',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable MemberPoints
CREATE TABLE IF NOT EXISTS "MemberPoints" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "username" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
    "pendingReward" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "lifetimeRewarded" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "payoutAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberPoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable EngagementActivity
CREATE TABLE IF NOT EXISTS "EngagementActivity" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "type" "EngagementActivityType" NOT NULL,
    "status" "EngagementActivityStatus" NOT NULL DEFAULT 'active',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "pointsReward" INTEGER NOT NULL DEFAULT 10,
    "telegramPollId" TEXT,
    "telegramMsgId" TEXT,
    "createdByUserId" TEXT,
    "closesAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngagementActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable ActivitySubmission
CREATE TABLE IF NOT EXISTS "ActivitySubmission" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "username" TEXT,
    "payload" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivitySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable RewardLedger
CREATE TABLE IF NOT EXISTS "RewardLedger" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "rewardAccountId" TEXT,
    "telegramUserId" TEXT NOT NULL,
    "kind" "RewardLedgerKind" NOT NULL,
    "status" "RewardLedgerStatus" NOT NULL DEFAULT 'pending',
    "pointsDelta" INTEGER NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USDm',
    "payoutId" TEXT,
    "destination" TEXT,
    "txHash" TEXT,
    "failureReason" TEXT,
    "metaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RewardAccount_groupId_key" ON "RewardAccount"("groupId");
CREATE UNIQUE INDEX IF NOT EXISTS "RewardAccount_accountKey_key" ON "RewardAccount"("accountKey");
CREATE INDEX IF NOT EXISTS "RewardAccount_ownerUserId_idx" ON "RewardAccount"("ownerUserId");

CREATE UNIQUE INDEX IF NOT EXISTS "MemberPoints_groupId_telegramUserId_key" ON "MemberPoints"("groupId", "telegramUserId");
CREATE INDEX IF NOT EXISTS "MemberPoints_groupId_points_idx" ON "MemberPoints"("groupId", "points");

CREATE INDEX IF NOT EXISTS "EngagementActivity_groupId_status_type_idx" ON "EngagementActivity"("groupId", "status", "type");

CREATE UNIQUE INDEX IF NOT EXISTS "ActivitySubmission_activityId_telegramUserId_key" ON "ActivitySubmission"("activityId", "telegramUserId");
CREATE INDEX IF NOT EXISTS "ActivitySubmission_telegramUserId_idx" ON "ActivitySubmission"("telegramUserId");

CREATE UNIQUE INDEX IF NOT EXISTS "RewardLedger_payoutId_key" ON "RewardLedger"("payoutId");
CREATE INDEX IF NOT EXISTS "RewardLedger_groupId_telegramUserId_status_idx" ON "RewardLedger"("groupId", "telegramUserId", "status");
CREATE INDEX IF NOT EXISTS "RewardLedger_status_kind_idx" ON "RewardLedger"("status", "kind");

DO $$ BEGIN
 ALTER TABLE "RewardAccount" ADD CONSTRAINT "RewardAccount_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TelegramGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "RewardAccount" ADD CONSTRAINT "RewardAccount_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "MemberPoints" ADD CONSTRAINT "MemberPoints_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TelegramGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "EngagementActivity" ADD CONSTRAINT "EngagementActivity_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TelegramGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "ActivitySubmission" ADD CONSTRAINT "ActivitySubmission_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "EngagementActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "RewardLedger" ADD CONSTRAINT "RewardLedger_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TelegramGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "RewardLedger" ADD CONSTRAINT "RewardLedger_rewardAccountId_fkey" FOREIGN KEY ("rewardAccountId") REFERENCES "RewardAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
