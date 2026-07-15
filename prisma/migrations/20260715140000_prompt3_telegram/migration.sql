-- Prompt 3: Telegram groups, FAQs, rolling context, smart wallet provider

-- Drop old Settings.groupId relation if present
ALTER TABLE "Settings" DROP CONSTRAINT IF EXISTS "Settings_groupId_fkey";
DROP INDEX IF EXISTS "Settings_groupId_key";
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "groupId";

ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'employment-contract';

ALTER TABLE "TelegramGroup" ADD COLUMN IF NOT EXISTS "ownerTelegramId" TEXT;
ALTER TABLE "TelegramGroup" ADD COLUMN IF NOT EXISTS "memberCount" INTEGER;
ALTER TABLE "TelegramGroup" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "TelegramGroup" ADD COLUMN IF NOT EXISTS "rules" TEXT;

CREATE TABLE IF NOT EXISTS "GroupSettings" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "welcomeMembers" BOOLEAN NOT NULL DEFAULT true,
    "replyToMentions" BOOLEAN NOT NULL DEFAULT true,
    "answerQuestions" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GroupSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GroupSettings_groupId_key" ON "GroupSettings"("groupId");
ALTER TABLE "GroupSettings" DROP CONSTRAINT IF EXISTS "GroupSettings_groupId_fkey";
ALTER TABLE "GroupSettings" ADD CONSTRAINT "GroupSettings_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TelegramGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "GroupEmployment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GroupEmployment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GroupEmployment_userId_groupId_key" ON "GroupEmployment"("userId", "groupId");
ALTER TABLE "GroupEmployment" DROP CONSTRAINT IF EXISTS "GroupEmployment_userId_fkey";
ALTER TABLE "GroupEmployment" DROP CONSTRAINT IF EXISTS "GroupEmployment_groupId_fkey";
ALTER TABLE "GroupEmployment" ADD CONSTRAINT "GroupEmployment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupEmployment" ADD CONSTRAINT "GroupEmployment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TelegramGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "GroupFAQ" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GroupFAQ_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GroupFAQ_groupId_idx" ON "GroupFAQ"("groupId");
ALTER TABLE "GroupFAQ" DROP CONSTRAINT IF EXISTS "GroupFAQ_groupId_fkey";
ALTER TABLE "GroupFAQ" ADD CONSTRAINT "GroupFAQ_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TelegramGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ConversationContext" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "telegramMessageId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "fromUsername" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationContext_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConversationContext_groupId_telegramMessageId_key" ON "ConversationContext"("groupId", "telegramMessageId");
CREATE INDEX IF NOT EXISTS "ConversationContext_groupId_createdAt_idx" ON "ConversationContext"("groupId", "createdAt");
ALTER TABLE "ConversationContext" DROP CONSTRAINT IF EXISTS "ConversationContext_groupId_fkey";
ALTER TABLE "ConversationContext" ADD CONSTRAINT "ConversationContext_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TelegramGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
