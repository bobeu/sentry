-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('url', 'file');

-- CreateEnum
CREATE TYPE "KnowledgeSourceStatus" AS ENUM ('pending', 'ready', 'failed');

-- CreateTable
CREATE TABLE "GroupKnowledgeSource" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "type" "KnowledgeSourceType" NOT NULL,
    "title" TEXT,
    "url" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "contentText" TEXT NOT NULL DEFAULT '',
    "byteSize" INTEGER NOT NULL DEFAULT 0,
    "status" "KnowledgeSourceStatus" NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupKnowledgeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupKnowledgeChunk" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupKnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupKnowledgeSource_groupId_idx" ON "GroupKnowledgeSource"("groupId");

-- CreateIndex
CREATE INDEX "GroupKnowledgeSource_groupId_status_idx" ON "GroupKnowledgeSource"("groupId", "status");

-- CreateIndex
CREATE INDEX "GroupKnowledgeChunk_groupId_idx" ON "GroupKnowledgeChunk"("groupId");

-- CreateIndex
CREATE INDEX "GroupKnowledgeChunk_sourceId_idx" ON "GroupKnowledgeChunk"("sourceId");

-- AddForeignKey
ALTER TABLE "GroupKnowledgeSource" ADD CONSTRAINT "GroupKnowledgeSource_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TelegramGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupKnowledgeChunk" ADD CONSTRAINT "GroupKnowledgeChunk_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TelegramGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupKnowledgeChunk" ADD CONSTRAINT "GroupKnowledgeChunk_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "GroupKnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
