-- Adds the columns + tables required by the /perfil/configuracoes
-- surface in apps/web:
--   * users.avatarUrl   — optional profile picture URL
--   * sessions.lastSeenAt — populated by the access-token guard so the
--     "última atividade há X" line in the sessions list isn't always
--     equal to createdAt
--   * two_factor_recovery_codes — one-time bypass codes generated when
--     2FA is enabled (or regenerated). We persist only the bcrypt hash.
ALTER TABLE "users" ADD COLUMN "avatarUrl" TEXT;

ALTER TABLE "sessions" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

CREATE TABLE "two_factor_recovery_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "two_factor_recovery_codes_userId_idx" ON "two_factor_recovery_codes"("userId");

ALTER TABLE "two_factor_recovery_codes"
    ADD CONSTRAINT "two_factor_recovery_codes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
