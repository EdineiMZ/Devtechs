-- =============================================================================
-- Migration: add_finance_module
--
-- Adds the finance domain: transactions (income/expense), cost centers,
-- invoices with line items, and supporting enums. Mirrors the Prisma
-- schema in schema.prisma; kept hand-rolled so the SQL is reviewable
-- during database change audits (the SZDevs DBA workflow reads
-- migration.sql, not schema.prisma).
-- =============================================================================

-- CreateEnum
CREATE TYPE "FinanceTransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FinanceTransactionCategory" AS ENUM (
    'SALARY',
    'SERVICE',
    'PRODUCT',
    'TAX',
    'INFRA',
    'MARKETING',
    'OTHER'
);

-- CreateEnum
CREATE TYPE "FinanceTransactionStatus" AS ENUM (
    'PENDING',
    'PAID',
    'OVERDUE',
    'CANCELLED'
);

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'PAID',
    'OVERDUE',
    'CANCELLED'
);

-- CreateTable
CREATE TABLE "finance_transactions" (
    "id" TEXT NOT NULL,
    "type" "FinanceTransactionType" NOT NULL,
    "category" "FinanceTransactionCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "status" "FinanceTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" DATE,
    "paidAt" TIMESTAMP(3),
    "projectId" TEXT,
    "costCenterId" TEXT,
    "attachmentKey" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_cost_centers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT,
    "budget" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_invoices" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "dueDate" DATE NOT NULL,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "finance_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finance_transactions_type_idx" ON "finance_transactions"("type");
CREATE INDEX "finance_transactions_category_idx" ON "finance_transactions"("category");
CREATE INDEX "finance_transactions_status_idx" ON "finance_transactions"("status");
CREATE INDEX "finance_transactions_date_idx" ON "finance_transactions"("date");
CREATE INDEX "finance_transactions_projectId_idx" ON "finance_transactions"("projectId");
CREATE INDEX "finance_transactions_costCenterId_idx" ON "finance_transactions"("costCenterId");
CREATE INDEX "finance_transactions_createdBy_idx" ON "finance_transactions"("createdBy");
CREATE INDEX "finance_transactions_status_dueDate_idx" ON "finance_transactions"("status", "dueDate");

CREATE INDEX "finance_cost_centers_projectId_idx" ON "finance_cost_centers"("projectId");
CREATE INDEX "finance_cost_centers_name_idx" ON "finance_cost_centers"("name");

CREATE UNIQUE INDEX "finance_invoices_number_key" ON "finance_invoices"("number");
CREATE INDEX "finance_invoices_clientId_idx" ON "finance_invoices"("clientId");
CREATE INDEX "finance_invoices_status_idx" ON "finance_invoices"("status");
CREATE INDEX "finance_invoices_issuedAt_idx" ON "finance_invoices"("issuedAt");
CREATE INDEX "finance_invoices_dueDate_idx" ON "finance_invoices"("dueDate");
CREATE INDEX "finance_invoices_status_dueDate_idx" ON "finance_invoices"("status", "dueDate");

CREATE INDEX "finance_invoice_items_invoiceId_idx" ON "finance_invoice_items"("invoiceId");

-- AddForeignKey
ALTER TABLE "finance_transactions"
    ADD CONSTRAINT "finance_transactions_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "finance_transactions"
    ADD CONSTRAINT "finance_transactions_costCenterId_fkey"
    FOREIGN KEY ("costCenterId") REFERENCES "finance_cost_centers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "finance_transactions"
    ADD CONSTRAINT "finance_transactions_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_cost_centers"
    ADD CONSTRAINT "finance_cost_centers_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "finance_invoices"
    ADD CONSTRAINT "finance_invoices_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_invoices"
    ADD CONSTRAINT "finance_invoices_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_invoice_items"
    ADD CONSTRAINT "finance_invoice_items_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "finance_invoices"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
