-- Prompt 4: ActionRecords, ephemeral context, group settings expansion

-- Drop unreliable owner assumption; store admins JSON instead
ALTER TABLE "TelegramGroup" DROP COLUMN IF EXISTS "ownerTelegramId";
ALTER TABLE "TelegramGroup" ADD COLUMN IF NOT EXISTS "adminTelegramIds" TEXT;
ALTER TABLE "TelegramGroup" ADD COLUMN IF NOT EXISTS "purpose" TEXT;

ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "spamModeration" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "mentionNotifications" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "dailySummaryHour" INTEGER NOT NULL DEFAULT 9;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "summaryToGroup" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "summaryToAdmins" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "summaryToPrivate" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "telegramUserId" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "telegramUsername" TEXT;

CREATE TYPE "ActionType" AS ENUM (
  'mention_reply',
  'welcome',
  'faq_answer',
  'spam_moderation',
  'daily_summary',
  'mention_notification'
);

CREATE TYPE "ActionStatus" AS ENUM ('completed', 'failed');

CREATE TABLE IF NOT EXISTS "ActionRecord" (
    "id" TEXT NOT NULL,
    "type" "ActionType" NOT NULL,
    "groupId" TEXT,
    "userId" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ActionStatus" NOT NULL DEFAULT 'completed',
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActionRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ActionRecord_userId_completedAt_idx" ON "ActionRecord"("userId", "completedAt");
CREATE INDEX IF NOT EXISTS "ActionRecord_groupId_completedAt_idx" ON "ActionRecord"("groupId", "completedAt");
CREATE INDEX IF NOT EXISTS "ActionRecord_completedAt_idx" ON "ActionRecord"("completedAt");

ALTER TABLE "ActionRecord" DROP CONSTRAINT IF EXISTS "ActionRecord_groupId_fkey";
ALTER TABLE "ActionRecord" DROP CONSTRAINT IF EXISTS "ActionRecord_userId_fkey";
ALTER TABLE "ActionRecord" ADD CONSTRAINT "ActionRecord_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TelegramGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionRecord" ADD CONSTRAINT "ActionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "content" TEXT;
ALTER TABLE "Report" ALTER COLUMN "userId" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "ConversationContext_createdAt_idx" ON "ConversationContext"("createdAt");
