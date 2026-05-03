/**
 * Test users used by the Playwright suite.
 *
 * These accounts are seeded by `scripts/seed-admin.mjs` (admin) and
 * `packages/database/prisma/seed.ts` (cliente, teste-e2e). When you
 * add a new role to the seed, also add an entry here so
 * `auth.setup.ts` can build a storage-state file for that role.
 *
 * Passwords live next to the emails on purpose â€” these are dev/test
 * credentials only. Production rotation is handled outside the repo.
 */

export type TestRole = 'admin' | 'client' | 'support';

export interface TestUser {
  role: TestRole;
  email: string;
  password: string;
  /**
   * Where the user is expected to land after a successful login.
   * Used by login + role-redirect specs to assert correct routing.
   */
  expectedHome: string;
  /**
   * Path to the Playwright storage-state file. The setup project
   * writes here; consuming projects read it via `use.storageState`.
   */
  storageStatePath: string;
}

export const ADMIN: TestUser = {
  role: 'admin',
  email: 'admin@SZDevs.com',
  password: 'Admin@SZDevs2026',
  expectedHome: '/admin',
  storageStatePath: '.auth/admin.json',
};

/**
 * Client persona â€” non-admin user with a verified email but no
 * elevated permissions. Lands on /perfil. The seed creates a row at
 * cliente@SZDevs.local; password is set by the seed.
 */
export const CLIENT: TestUser = {
  role: 'client',
  email: 'cliente@SZDevs.local',
  password: process.env.E2E_CLIENT_PASSWORD ?? 'Cliente@SZDevs2026',
  expectedHome: '/perfil',
  storageStatePath: '.auth/client.json',
};

/**
 * Support agent persona â€” held in stub form here so the support
 * specs can plug in once the seed grows a real "support" role.
 * The login flow falls back gracefully if this role doesn't exist
 * yet (the setup project skips users it can't authenticate).
 */
export const SUPPORT: TestUser = {
  role: 'support',
  email: process.env.E2E_SUPPORT_EMAIL ?? 'support@SZDevs.local',
  password: process.env.E2E_SUPPORT_PASSWORD ?? 'Support@SZDevs2026',
  expectedHome: '/admin/suporte',
  storageStatePath: '.auth/support.json',
};

export const ALL_USERS: TestUser[] = [ADMIN, CLIENT, SUPPORT];
