-- Migration: add_api_keys_module
-- Adds API key management tables for the public api.szdevs.com gateway.
-- API keys use format szd_live_{8chars}_{32chars}, prefix stored in plaintext
-- for O(1) lookup, secret stored as bcrypt hash.

-- Status enum
CREATE TYPE "ApiKeyStatus" AS ENUM (
  'ACTIVE',
  'REVOKED',
  'SUSPENDED',
  'EXPIRED'
);

-- IP binding strategy
CREATE TYPE "IpBindingMode" AS ENUM (
  'DISABLED',
  'AUTO',
  'MANUAL'
);

-- API keys table
CREATE TABLE "api_keys" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "keyPrefix"     TEXT NOT NULL,
    "keyHash"       TEXT NOT NULL,
    "status"        "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "permissions"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "ipBinding"     "IpBindingMode" NOT NULL DEFAULT 'DISABLED',
    "boundIps"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "rateLimit"     JSONB NOT NULL,
    "expiresAt"     TIMESTAMP(3),
    "lastUsedAt"    TIMESTAMP(3),
    "lastUsedIp"    TEXT,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "revokeReason"  TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_keys_keyPrefix_key" ON "api_keys"("keyPrefix");
CREATE INDEX "api_keys_status_idx" ON "api_keys"("status");
CREATE INDEX "api_keys_createdAt_idx" ON "api_keys"("createdAt");

-- Audit log for every API key event
CREATE TABLE "api_key_audit_logs" (
    "id"         TEXT NOT NULL,
    "apiKeyId"   TEXT NOT NULL,
    "event"      TEXT NOT NULL,
    "ip"         TEXT,
    "endpoint"   TEXT,
    "statusCode" INTEGER,
    "meta"       JSONB NOT NULL DEFAULT '{}',
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_key_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "api_key_audit_logs_apiKeyId_idx" ON "api_key_audit_logs"("apiKeyId");
CREATE INDEX "api_key_audit_logs_event_idx" ON "api_key_audit_logs"("event");
CREATE INDEX "api_key_audit_logs_createdAt_idx" ON "api_key_audit_logs"("createdAt");

ALTER TABLE "api_key_audit_logs"
    ADD CONSTRAINT "api_key_audit_logs_apiKeyId_fkey"
    FOREIGN KEY ("apiKeyId")
    REFERENCES "api_keys"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
