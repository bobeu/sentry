-- AlterEnum ActionType
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'shift_handover';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'escalation';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'playbook_learn';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'intent_signal';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'incident_mode';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'member_memory';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'agent_task';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'proof_report';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EscalationStatus" AS ENUM ('pending', 'approved', 'edited', 'ignored', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "IncidentStatus" AS ENUM ('open', 'monitoring', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReportKind" AS ENUM ('daily', 'shift', 'proof');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PlaybookSource" AS ENUM ('correction', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- GroupSettings additive flags
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "shiftHandover" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "escalationLadder" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "livingPlaybook" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "intentSensing" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "proofOfWork" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "incidentMode" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "memberMemoryEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "hireInTelegram" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "personaRole" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "GroupSettings" ADD COLUMN IF NOT EXISTS "personaTone" TEXT;

-- Report.kind
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "kind" "ReportKind" NOT NULL DEFAULT 'daily';
CREATE INDEX IF NOT EXISTS "Report_userId_kind_createdAt_idx" ON "Report"("userId", "kind", "createdAt");
CREATE INDEX IF NOT EXISTS "Report_groupId_kind_createdAt_idx" ON "Report"("groupId", "kind", "createdAt");

-- Settings.agentApiEnabled
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "agentApiEnabled" BOOLEAN NOT NULL DEFAULT false;

-- PlaybookRule
CREATE TABLE IF NOT EXISTS "PlaybookRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT,
    "trigger" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "source" "PlaybookSource" NOT NULL DEFAULT 'manual',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlaybookRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PlaybookRule_userId_active_idx" ON "PlaybookRule"("userId", "active");
CREATE INDEX IF NOT EXISTS "PlaybookRule_groupId_active_idx" ON "PlaybookRule"("groupId", "active");

-- Escalation
CREATE TABLE IF NOT EXISTS "Escalation" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "EscalationStatus" NOT NULL DEFAULT 'pending',
    "draftText" TEXT NOT NULL,
    "reason" TEXT,
    "sourceTelegramMsgId" TEXT,
    "sourceChatId" TEXT,
    "employerTelegramMsgId" TEXT,
    "finalText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "Escalation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Escalation_userId_status_createdAt_idx" ON "Escalation"("userId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Escalation_groupId_status_idx" ON "Escalation"("groupId", "status");

-- MemberMemory
CREATE TABLE IF NOT EXISTS "MemberMemory" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemberMemory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MemberMemory_groupId_telegramUserId_key" ON "MemberMemory"("groupId", "telegramUserId");
CREATE INDEX IF NOT EXISTS "MemberMemory_telegramUserId_idx" ON "MemberMemory"("telegramUserId");

-- IncidentEvent
CREATE TABLE IF NOT EXISTS "IncidentEvent" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'open',
    "timeline" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "IncidentEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IncidentEvent_groupId_status_createdAt_idx" ON "IncidentEvent"("groupId", "status", "createdAt");

-- AgentApiKey
CREATE TABLE IF NOT EXISTS "AgentApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentApiKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgentApiKey_keyHash_key" ON "AgentApiKey"("keyHash");
CREATE INDEX IF NOT EXISTS "AgentApiKey_userId_revokedAt_idx" ON "AgentApiKey"("userId", "revokedAt");

-- FKs (ignore if already present)
DO $$ BEGIN
  ALTER TABLE "PlaybookRule" ADD CONSTRAINT "PlaybookRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PlaybookRule" ADD CONSTRAINT "PlaybookRule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TelegramGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Escalation" ADD CONSTRAINT "Escalation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TelegramGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Escalation" ADD CONSTRAINT "Escalation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MemberMemory" ADD CONSTRAINT "MemberMemory_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TelegramGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "IncidentEvent" ADD CONSTRAINT "IncidentEvent_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TelegramGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "AgentApiKey" ADD CONSTRAINT "AgentApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
