ALTER TABLE "Settings"
ADD COLUMN "preferredNetwork" TEXT NOT NULL DEFAULT 'CELO',
ADD COLUMN "goatAgentId" TEXT,
ADD COLUMN "goatAgentUri" TEXT,
ADD COLUMN "goatRegisteredAt" TIMESTAMP(3),
ADD COLUMN "goatRegistrationTx" TEXT;
