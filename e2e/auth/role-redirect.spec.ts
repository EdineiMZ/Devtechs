import { expect, test } from '@playwright/test';

import { ADMIN, CLIENT } from '../fixtures/users';

/**
 * Each role must land on its expected home after login, and the
 * middleware must bounce anonymous and under-privileged users.
 *
 * Note: there is no /403 page in apps/web yet — the middleware
 * redirects under-privileged sessions to /perfil instead. The spec
 * asserts that observed behavior; flip to /403 once the page lands.
 */

test.describe('auth/role-redirect', () => {
  for (const user of [ADMIN, CLIENT]) {
    test(`${user.role} → ${user.expectedHome} after login`, async ({ page }) => {
      await page.goto('/login');
      await page.locator('input[type="email"]').fill(user.email);
      await page.locator('input[type="password"]').fill(user.password);
      await page.locator('button[type="submit"]').click();

      await page.waitForURL((u) => !u.toString().includes('/login'), {
        timeout: 10_000,
      });

      // Some flows take an extra hop (e.g. unverified email). We only
      // assert the FINAL URL contains the expected prefix once
      // network has settled.
      await page.waitForLoadState('networkidle');
      const finalUrl = page.url();
      expect(
        finalUrl.includes(user.expectedHome) || finalUrl.includes('/verificar-email'),
        `expected ${user.role} on ${user.expectedHome} or /verificar-email, got ${finalUrl}`,
      ).toBe(true);
    });
  }

  test('anonymous → protected route bounces to /login with callbackUrl', async ({ page }) => {
    const target = '/admin/auditoria';
    const resp = await page.goto(target);
    expect(resp).toBeTruthy();
    // Middleware sends 307 with a Location to /login?callbackUrl=...
    // Playwright follows the redirect, so we assert the final URL.
    await expect(page).toHaveURL(/\/login\?callbackUrl=.*/);
    expect(page.url()).toContain(encodeURIComponent(target));
  });

  test('client without permission → /perfil (no /admin)', async ({ page }) => {
    // Login as client first.
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(CLIENT.email);
    await page.locator('input[type="password"]').fill(CLIENT.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => !u.toString().includes('/login'));

    // Now try to access an admin-only route. Server component checks
    // `permissions.includes('dev:logs:view')` and `redirect('/perfil')`.
    await page.goto('/admin/auditoria');
    await expect(page).toHaveURL(/\/(perfil|verificar-email)/);
  });

  test.fixme('expired session → /login with reason banner', async ({ page }) => {
    // Wire-up: clear or fast-forward the session cookie
    //   await page.context().clearCookies();
    // then visit a protected route. The middleware should redirect
    // to /login?callbackUrl=... ideally with a `reason=session_expired`
    // search param the form maps to a friendly banner. The reason
    // param doesn't exist yet — flip this fixme to a real test once
    // it ships.
    expect(page).toBeDefined();
  });
});
