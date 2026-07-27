-- AlterEnum
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'admin_moderation';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'rose_relay';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'announcement';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'birthday';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'secretary_reply';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'secretary_escalation';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AnnouncementStatus" AS ENUM ('scheduled', 'posted', 'cancelled', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "TelegramGroup" ADD COLUMN IF NOT EXISTS "botCanRestrict" BOOLEAN;
ALTER TABLE "TelegramGroup" ADD COLUMN IF NOT EXISTS "botCanBan" BOOLEAN;

-- AlterTable
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "adminModeration" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "roseRelayEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "roseBotUsername" TEXT NOT NULL DEFAULT 'MissRose_bot';
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "announcementsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "birthdaysEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "birthdayHourUtc" INTEGER NOT NULL DEFAULT 9;

-- CreateTable
CREATE TABLE "BusinessConnectionRecord" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "userTelegramId" TEXT NOT NULL,
    "userChatId" TEXT NOT NULL,
    "canReply" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,
    "rightsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessConnectionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupAnnouncement" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT,
    "text" TEXT NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'scheduled',
    "scheduledAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberBirthday" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "displayName" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCelebratedYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberBirthday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessConnectionRecord_connectionId_key" ON "BusinessConnectionRecord"("connectionId");
CREATE INDEX "BusinessConnectionRecord_userTelegramId_idx" ON "BusinessConnectionRecord"("userTelegramId");
CREATE INDEX "BusinessConnectionRecord_userId_isEnabled_idx" ON "BusinessConnectionRecord"("userId", "isEnabled");

CREATE INDEX "GroupAnnouncement_groupId_status_scheduledAt_idx" ON "GroupAnnouncement"("groupId", "status", "scheduledAt");
CREATE INDEX "GroupAnnouncement_status_scheduledAt_idx" ON "GroupAnnouncement"("status", "scheduledAt");

CREATE UNIQUE INDEX "MemberBirthday_groupId_telegramUserId_key" ON "MemberBirthday"("groupId", "telegramUserId");
CREATE INDEX "MemberBirthday_month_day_idx" ON "MemberBirthday"("month", "day");

-- AddForeignKey
ALTER TABLE "BusinessConnectionRecord" ADD CONSTRAINT "BusinessConnectionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GroupAnnouncement" ADD CONSTRAINT "GroupAnnouncement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TelegramGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupAnnouncement" ADD CONSTRAINT "GroupAnnouncement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MemberBirthday" ADD CONSTRAINT "MemberBirthday_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TelegramGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
