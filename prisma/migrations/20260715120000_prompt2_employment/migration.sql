-- AlterTable: Prompt 2 employment + wallet balance
CREATE TYPE "EmploymentStatus" AS ENUM ('Inactive', 'Active', 'Paused', 'Exhausted');

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Wallet: require address, add balance
ALTER TABLE "Wallet" ALTER COLUMN "address" SET NOT NULL;
ALTER TABLE "Wallet" ADD COLUMN "balance" DECIMAL(36, 18) NOT NULL DEFAULT 0;

-- Employment: drop group requirement, add status fields
ALTER TABLE "Employment" DROP CONSTRAINT IF EXISTS "Employment_groupId_fkey";
DROP INDEX IF EXISTS "Employment_userId_groupId_key";
ALTER TABLE "Employment" DROP COLUMN IF EXISTS "groupId";
ALTER TABLE "Employment" ADD COLUMN "status" "EmploymentStatus" NOT NULL DEFAULT 'Inactive';
ALTER TABLE "Employment" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "Employment" ADD COLUMN "pausedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Employment_userId_key" ON "Employment"("userId");

-- Task: group optional
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_groupId_fkey";
ALTER TABLE "Task" ALTER COLUMN "groupId" DROP NOT NULL;
ALTER TABLE "Task" ADD CONSTRAINT "Task_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TelegramGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Settings fields
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "timeZone" TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "autoResume" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "emailNotifications" BOOLEAN NOT NULL DEFAULT true;
