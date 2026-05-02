-- =============================================================================
-- Migration: add_payments_module
--
-- Plans, subscriptions, payments, coupons. Mirrors the Prisma
-- schema in schema.prisma.
-- =============================================================================

-- CreateEnum
CREATE TYPE "PlanInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM (
    'ACTIVE',
    'CANCELLED',
    'PAST_DUE',
    'TRIALING',
    'EXPIRED'
);

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'BOLETO', 'CREDIT_CARD', 'DEBIT_CARD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED',
    'EXPIRED'
);

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateTable
CREATE TABLE "payments_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(14,2) NOT NULL,
    "interval" "PlanInterval" NOT NULL,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "externalId" TEXT,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments_payments" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "externalUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments_coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL,
    "type" "CouponType" NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 0,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_plans_isActive_idx" ON "payments_plans"("isActive");

CREATE UNIQUE INDEX "payments_subscriptions_externalId_key" ON "payments_subscriptions"("externalId");
CREATE INDEX "payments_subscriptions_userId_status_idx" ON "payments_subscriptions"("userId", "status");
CREATE INDEX "payments_subscriptions_externalId_idx" ON "payments_subscriptions"("externalId");
CREATE INDEX "payments_subscriptions_status_idx" ON "payments_subscriptions"("status");

CREATE UNIQUE INDEX "payments_payments_externalId_key" ON "payments_payments"("externalId");
CREATE INDEX "payments_payments_subscriptionId_idx" ON "payments_payments"("subscriptionId");
CREATE INDEX "payments_payments_userId_idx" ON "payments_payments"("userId");
CREATE INDEX "payments_payments_externalId_idx" ON "payments_payments"("externalId");
CREATE INDEX "payments_payments_status_idx" ON "payments_payments"("status");

CREATE UNIQUE INDEX "payments_coupons_code_key" ON "payments_coupons"("code");
CREATE INDEX "payments_coupons_isActive_idx" ON "payments_coupons"("isActive");

-- AddForeignKey
ALTER TABLE "payments_subscriptions"
    ADD CONSTRAINT "payments_subscriptions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments_subscriptions"
    ADD CONSTRAINT "payments_subscriptions_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "payments_plans"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments_payments"
    ADD CONSTRAINT "payments_payments_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "payments_subscriptions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments_payments"
    ADD CONSTRAINT "payments_payments_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default plans
INSERT INTO "payments_plans" ("id", "name", "description", "price", "interval", "features", "trialDays", "isActive", "createdAt", "updatedAt")
VALUES
    ('plan_starter', 'Starter', 'Para startups e times pequenos', 97.00, 'MONTHLY',
     ARRAY['3 projetos', '5 usuários', 'Suporte por email', 'SLA 48h'],
     7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('plan_pro', 'Professional', 'Para empresas em crescimento', 297.00, 'MONTHLY',
     ARRAY['Projetos ilimitados', '25 usuários', 'Suporte prioritário', 'SLA 8h', 'DevOps integrado', 'API access'],
     14, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('plan_enterprise', 'Enterprise', 'Para grandes operações', 997.00, 'MONTHLY',
     ARRAY['Projetos ilimitados', 'Usuários ilimitados', 'Suporte 24/7', 'SLA 1h', 'DevOps avançado', 'API access', 'SSO', 'Audit logs'],
     30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
