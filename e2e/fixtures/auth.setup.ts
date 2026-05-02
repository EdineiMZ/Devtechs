import { expect, type Page, test as setup } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { ALL_USERS, type TestUser } from './users';

/**
 * One-shot login per role. Saves the resulting cookie jar to
 * `<role>.json` so every spec project can start authenticated by
 * pointing `storageState` at the right file.
 *
 * Resilience:
 *   - For non-essential roles (e.g. SUPPORT before that module
 *     ships) the step logs and continues. The dependent project
 *     ("support") will then fail at storage-state load with a clear
 *     error — that's accepted; it surfaces the missing seed.
 */

setup.describe.configure({ mode: 'serial' });

// Give each setup test enough time for Redis-unavailable delays (~10s)
// plus the login flow itself. The global default is 30s which is too tight
// when auth-service Redis times out on first boot.
setup.setTimeout(90_000);

async function loginAndSaveState(user: TestUser, page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill(user.email);
  await page.locator('input[type="password"]').first().fill(user.password);
  await page.locator('button[type="submit"]').first().click();

  // Wait for the redirect away from /login. We don't pin the exact
  // landing URL because a user with an unverified email is bounced
  // to /verificar-email — still a "login worked" signal.
  await page.waitForURL((url) => !url.toString().includes('/login'), {
    timeout: 45_000,
  });

  mkdirSync(dirname(user.storageStatePath), { recursive: true });
  await page.context().storageState({ path: user.storageStatePath });

  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(
    (c) => /session-token/i.test(c.name) || c.name === 'authjs.session-token',
  );
  expect(sessionCookie, `${user.role}: session cookie should be set`).toBeDefined();
}

for (const user of ALL_USERS) {
  setup(`authenticate ${user.role}`, async ({ page }) => {
    try {
      await loginAndSaveState(user, page);
    } catch (err) {
      if (user.role === 'admin' || user.role === 'client') {
        throw err;
      }
      // Non-essential role — log + skip so the rest of the suite
      // keeps running. The dependent project will surface its own
      // failure when it can't find the storage-state file.
      // eslint-disable-next-line no-console
      console.warn(
        `[auth.setup] skipping ${user.role}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  });
}
