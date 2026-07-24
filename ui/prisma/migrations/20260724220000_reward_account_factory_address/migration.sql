-- Track which RewardFactory deployed each RewardAccount (redeploy staleness detection)
ALTER TABLE "RewardAccount" ADD COLUMN IF NOT EXISTS "factoryAddress" TEXT;
CREATE INDEX IF NOT EXISTS "RewardAccount_factoryAddress_idx" ON "RewardAccount"("factoryAddress");
