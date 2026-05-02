-- VPS Management Module
-- Links Hostinger VMs to internal clients. The Hostinger API is the
-- source of truth for the VM itself — this table only stores the
-- relation (which client owns which VM), plus operator-side metadata
-- (label, internal notes) that lives outside Hostinger.

CREATE TABLE "client_vps" (
    "id"         TEXT NOT NULL,
    "clientId"   TEXT NOT NULL,
    "vmId"       TEXT NOT NULL,
    "label"      TEXT NOT NULL,
    "hostname"   TEXT NOT NULL,
    "plan"       TEXT NOT NULL,
    "dataCenter" TEXT NOT NULL,
    "ipv4"       TEXT NOT NULL,
    "notes"      TEXT,
    "addedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedBy"    TEXT NOT NULL,
    CONSTRAINT "client_vps_pkey" PRIMARY KEY ("id")
);

-- A single Hostinger VM may only be attached to one client at a time.
CREATE UNIQUE INDEX "client_vps_vmId_key" ON "client_vps"("vmId");

CREATE INDEX "client_vps_clientId_idx" ON "client_vps"("clientId");
CREATE INDEX "client_vps_addedAt_idx"  ON "client_vps"("addedAt");

-- Restrict deletes on the linked client/operator so detaching a VPS
-- is always an explicit action, never a side-effect of removing a user.
ALTER TABLE "client_vps"
    ADD CONSTRAINT "client_vps_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "client_vps"
    ADD CONSTRAINT "client_vps_addedBy_fkey"
    FOREIGN KEY ("addedBy")  REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
