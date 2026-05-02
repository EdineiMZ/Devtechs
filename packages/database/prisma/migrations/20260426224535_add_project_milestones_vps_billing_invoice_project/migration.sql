-- AlterTable
ALTER TABLE "client_vps" ADD COLUMN     "billingDayOfMonth" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "lastBilledAt" TIMESTAMP(3),
ADD COLUMN     "monthlyPrice" DECIMAL(14,2),
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "suspendAfterDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "finance_invoices" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "payments_payments" ADD COLUMN     "invoiceId" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "githubRepo" TEXT,
ADD COLUMN     "progressPercent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "project_milestones" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "dueDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_milestones_projectId_order_idx" ON "project_milestones"("projectId", "order");

-- CreateIndex
CREATE INDEX "client_vps_projectId_idx" ON "client_vps"("projectId");

-- CreateIndex
CREATE INDEX "finance_invoices_projectId_idx" ON "finance_invoices"("projectId");

-- CreateIndex
CREATE INDEX "payments_payments_invoiceId_idx" ON "payments_payments"("invoiceId");

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_invoices" ADD CONSTRAINT "finance_invoices_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments_payments" ADD CONSTRAINT "payments_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "finance_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_vps" ADD CONSTRAINT "client_vps_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
