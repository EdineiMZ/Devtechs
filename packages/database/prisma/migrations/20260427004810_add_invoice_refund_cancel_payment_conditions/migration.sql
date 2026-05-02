-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "finance_invoices" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "finance_payment_conditions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "installments" INTEGER NOT NULL,
    "interestRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_payment_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finance_payment_conditions_active_idx" ON "finance_payment_conditions"("active");

-- CreateIndex
CREATE UNIQUE INDEX "finance_payment_conditions_installments_key" ON "finance_payment_conditions"("installments");
