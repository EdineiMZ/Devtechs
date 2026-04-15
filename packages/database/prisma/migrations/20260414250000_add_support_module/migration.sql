-- =============================================================================
-- Migration: add_support_module
--
-- Tickets, messages, attachments, SLA policies. Mirrors the Prisma
-- schema in schema.prisma; kept hand-rolled so the SQL is reviewable
-- during database change audits.
-- =============================================================================

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'WAITING_CLIENT',
    'RESOLVED',
    'CLOSED'
);

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('BUG', 'FEATURE', 'QUESTION', 'BILLING', 'OTHER');

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "category" "TicketCategory" NOT NULL DEFAULT 'QUESTION',
    "clientId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "slaDeadline" TIMESTAMP(3),
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "rating" INTEGER,
    "ratingComment" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_attachments" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "messageId" TEXT,
    "fileKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_sla_policies" (
    "id" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL,
    "firstResponseHours" INTEGER NOT NULL,
    "resolutionHours" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_number_key" ON "support_tickets"("number");
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");
CREATE INDEX "support_tickets_priority_idx" ON "support_tickets"("priority");
CREATE INDEX "support_tickets_category_idx" ON "support_tickets"("category");
CREATE INDEX "support_tickets_clientId_status_idx" ON "support_tickets"("clientId", "status");
CREATE INDEX "support_tickets_assigneeId_status_idx" ON "support_tickets"("assigneeId", "status");
CREATE INDEX "support_tickets_slaDeadline_idx" ON "support_tickets"("slaDeadline");
CREATE INDEX "support_tickets_createdAt_idx" ON "support_tickets"("createdAt");

CREATE INDEX "support_ticket_messages_ticketId_createdAt_idx" ON "support_ticket_messages"("ticketId", "createdAt");
CREATE INDEX "support_ticket_messages_authorId_idx" ON "support_ticket_messages"("authorId");

CREATE INDEX "support_ticket_attachments_ticketId_idx" ON "support_ticket_attachments"("ticketId");
CREATE INDEX "support_ticket_attachments_messageId_idx" ON "support_ticket_attachments"("messageId");

CREATE UNIQUE INDEX "support_sla_policies_priority_key" ON "support_sla_policies"("priority");

-- AddForeignKey
ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "support_ticket_messages"
    ADD CONSTRAINT "support_ticket_messages_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_ticket_messages"
    ADD CONSTRAINT "support_ticket_messages_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "support_ticket_attachments"
    ADD CONSTRAINT "support_ticket_attachments_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_ticket_attachments"
    ADD CONSTRAINT "support_ticket_attachments_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "support_ticket_messages"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default SLA policies — one per priority level. Idempotent via
-- the unique index on priority; running this migration twice is a
-- no-op on the second pass.
INSERT INTO "support_sla_policies" ("id", "priority", "firstResponseHours", "resolutionHours", "isActive", "createdAt", "updatedAt")
VALUES
    ('sla_pol_low',      'LOW',      24, 120, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sla_pol_medium',   'MEDIUM',    8,  48, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sla_pol_high',     'HIGH',      4,  16, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('sla_pol_critical', 'CRITICAL',  1,   4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
