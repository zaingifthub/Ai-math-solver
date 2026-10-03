-- AlterTable
ALTER TABLE "UsageEvent" ADD COLUMN     "ipHash" TEXT;

-- CreateIndex
CREATE INDEX "UsageEvent_ipHash_kind_createdAt_idx" ON "UsageEvent"("ipHash", "kind", "createdAt");
