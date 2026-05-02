-- License Module
-- Products, client bindings, activation tokens, and activation log.

-- Enum: token lifecycle status
CREATE TYPE "TokenStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- Licensed products registered in the platform
CREATE TABLE "license_products" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "appId"       TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "license_products_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "license_products_appId_key" ON "license_products"("appId");

-- Which clients are bound to which products
CREATE TABLE "license_client_bindings" (
    "id"         TEXT NOT NULL,
    "clientId"   TEXT NOT NULL,
    "productId"  TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt"  TIMESTAMP(3),
    CONSTRAINT "license_client_bindings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "license_client_bindings_clientId_productId_key"
    ON "license_client_bindings"("clientId", "productId");
CREATE INDEX "license_client_bindings_clientId_idx" ON "license_client_bindings"("clientId");
CREATE INDEX "license_client_bindings_productId_idx" ON "license_client_bindings"("productId");

ALTER TABLE "license_client_bindings"
    ADD CONSTRAINT "license_client_bindings_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "license_client_bindings"
    ADD CONSTRAINT "license_client_bindings_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "license_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "license_client_bindings"
    ADD CONSTRAINT "license_client_bindings_assignedBy_fkey"
    FOREIGN KEY ("assignedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Activation tokens issued to clients
CREATE TABLE "license_activation_tokens" (
    "id"           TEXT NOT NULL,
    "key"          TEXT NOT NULL,
    "hash"         TEXT NOT NULL,
    "clientId"     TEXT NOT NULL,
    "productId"    TEXT NOT NULL,
    "maxUses"      INTEGER,
    "usedCount"    INTEGER NOT NULL DEFAULT 0,
    "expiresAt"    TIMESTAMP(3),
    "hardwareId"   TEXT,
    "status"       "TokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedBy"     TEXT NOT NULL,
    "issuedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedBy"    TEXT,
    "revokedAt"    TIMESTAMP(3),
    "revokeReason" TEXT,
    CONSTRAINT "license_activation_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "license_activation_tokens_key_key" ON "license_activation_tokens"("key");
CREATE INDEX "license_activation_tokens_clientId_idx" ON "license_activation_tokens"("clientId");
CREATE INDEX "license_activation_tokens_productId_idx" ON "license_activation_tokens"("productId");
CREATE INDEX "license_activation_tokens_status_idx" ON "license_activation_tokens"("status");
CREATE INDEX "license_activation_tokens_hash_idx" ON "license_activation_tokens"("hash");

ALTER TABLE "license_activation_tokens"
    ADD CONSTRAINT "license_activation_tokens_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "license_activation_tokens"
    ADD CONSTRAINT "license_activation_tokens_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "license_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "license_activation_tokens"
    ADD CONSTRAINT "license_activation_tokens_issuedBy_fkey"
    FOREIGN KEY ("issuedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "license_activation_tokens"
    ADD CONSTRAINT "license_activation_tokens_revokedBy_fkey"
    FOREIGN KEY ("revokedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Activation log — every time a token is verified/used
CREATE TABLE "license_token_activations" (
    "id"          TEXT NOT NULL,
    "tokenId"     TEXT NOT NULL,
    "hardwareId"  TEXT,
    "appVersion"  TEXT,
    "ipAddress"   TEXT,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "license_token_activations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "license_token_activations_tokenId_idx" ON "license_token_activations"("tokenId");

ALTER TABLE "license_token_activations"
    ADD CONSTRAINT "license_token_activations_tokenId_fkey"
    FOREIGN KEY ("tokenId") REFERENCES "license_activation_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
