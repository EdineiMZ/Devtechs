-- Migration: add_recurring_billing
-- Adds product catalog and recurring billing subscription models
-- to drive automatic monthly invoice generation.

-- Create enum for recurring subscription status
CREATE TYPE "RecurringSubscriptionStatus" AS ENUM (
  'ACTIVE',
  'CANCELLED',
  'EXPIRED',
  'SUSPENDED'
);

-- Product/service catalog
CREATE TABLE "billing_products" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "unitPrice"   DECIMAL(14,2) NOT NULL,
    "unit"        TEXT NOT NULL DEFAULT 'mês',
    "category"    TEXT,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_products_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "billing_products_isActive_idx" ON "billing_products"("isActive");

-- Recurring billing subscriptions (billing contracts per client)
CREATE TABLE "billing_recurring_subscriptions" (
    "id"              TEXT NOT NULL,
    "clientId"        TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "status"          "RecurringSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "billingDay"      INTEGER NOT NULL DEFAULT 1,
    "billingDueDays"  INTEGER NOT NULL DEFAULT 5,
    "nextBillingDate" DATE NOT NULL,
    "cancelledAt"     TIMESTAMP(3),
    "cancelReason"    TEXT,
    "endsAt"          TIMESTAMP(3),
    "notes"           TEXT,
    "createdBy"       TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_recurring_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "billing_recurring_subscriptions_clientId_idx" ON "billing_recurring_subscriptions"("clientId");
CREATE INDEX "billing_recurring_subscriptions_status_idx" ON "billing_recurring_subscriptions"("status");
CREATE INDEX "billing_recurring_subscriptions_nextBillingDate_idx" ON "billing_recurring_subscriptions"("nextBillingDate");

-- Line items for each recurring subscription
CREATE TABLE "billing_recurring_subscription_items" (
    "id"             TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "productId"      TEXT,
    "description"    TEXT NOT NULL,
    "quantity"       DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unitPrice"      DECIMAL(14,2) NOT NULL,
    "total"          DECIMAL(14,2) NOT NULL,

    CONSTRAINT "billing_recurring_subscription_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "billing_recurring_subscription_items_subscriptionId_idx"
    ON "billing_recurring_subscription_items"("subscriptionId");

-- Foreign key constraints
ALTER TABLE "billing_recurring_subscriptions"
    ADD CONSTRAINT "billing_recurring_subscriptions_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_recurring_subscriptions"
    ADD CONSTRAINT "billing_recurring_subscriptions_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_recurring_subscription_items"
    ADD CONSTRAINT "billing_recurring_subscription_items_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "billing_recurring_subscriptions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "billing_recurring_subscription_items"
    ADD CONSTRAINT "billing_recurring_subscription_items_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "billing_products"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
