-- Add invoiceId to finance_transactions for auto-generated invoice payment records.
-- The UNIQUE constraint ensures only one FinanceTransaction exists per Invoice
-- (idempotent webhook handling).
ALTER TABLE "finance_transactions" ADD COLUMN "invoiceId" TEXT;
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_invoiceId_key" UNIQUE ("invoiceId");
