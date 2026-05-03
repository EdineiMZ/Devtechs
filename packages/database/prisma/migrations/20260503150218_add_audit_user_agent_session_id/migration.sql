-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- CreateIndex
CREATE INDEX "audit_logs_sessionId_idx" ON "audit_logs"("sessionId");
