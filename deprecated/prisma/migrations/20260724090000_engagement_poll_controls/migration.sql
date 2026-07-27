-- AlterTable
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "pollsAnonymous" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "membersCanStartActivities" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "engagementSourceUrl" TEXT;
