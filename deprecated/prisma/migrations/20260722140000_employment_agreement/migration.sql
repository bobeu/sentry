-- AlterTable
ALTER TABLE "Employment" ADD COLUMN IF NOT EXISTS "agreementVersion" TEXT;
ALTER TABLE "Employment" ADD COLUMN IF NOT EXISTS "agreementAcceptedAt" TIMESTAMP(3);
ALTER TABLE "Employment" ADD COLUMN IF NOT EXISTS "agreementRejectedAt" TIMESTAMP(3);
