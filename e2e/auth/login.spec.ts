import { expect, test } from '@playwright/test';

import { ADMIN, CLIENT } from '../fixtures/users';

/**
 * Coverage for `/login` (apps/web). Each test starts anonymous; the
 * "anonymous" project doesn't load any storageState so cookies are
 * fresh between tests.
 *
 * Two of the cases — email-not-verified banner and 2FA flow — depend
 * on test users seeded with those flags. Marked `fixme` until the
 * seed grows them; the spec body documents the assertion shape so
 * wiring them is just data work, not logic work.
 */

test.describe('auth/login', () => {
  test('admin: valid credentials → /admin', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill(ADMIN.password);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/admin', { timeout: 10_000 });
    expect(page.url()).toContain(ADMIN.expectedHome);

    // Session cookie must be httpOnly — leaking it to JS is a P0 bug.
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => /session-token/i.test(c.name));
    expect(session?.httpOnly).toBe(true);
  });

  test('client: valid credentials → /perfil', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(CLIENT.email);
    await page.locator('input[type="password"]').fill(CLIENT.password);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 10_000 });
    // Accept /perfil OR /verificar-email (middleware bounces unverified users).
    expect(page.url()).toMatch(/\/(perfil|verificar-email)/);
  });

  test('invalid credentials → inline error banner', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill('definitely-wrong-password');
    await page.locator('button[type="submit"]').click();

    // Stay on /login + show the credentials banner. We assert text
    // content that the form's `mapAuthorizeError` renders for the
    // INVALID_CREDENTIALS sentinel (login-form.tsx).
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('alert').filter({ hasText: /credenciais inválidas/i }).first()).toBeVisible();
  });

  test('rate-limit: 6 failed attempts → blocked banner', async ({ page }) => {
    // Default LoginRateLimitGuard threshold is 5 in 15 min. In dev we
    // raised it to 5000 so the rest of the suite isn't affected; this
    // test only runs against an env where E2E_LOGIN_RATE_LIMIT=true.
    test.skip(
      process.env.E2E_LOGIN_RATE_LIMIT !== 'true',
      'Run with E2E_LOGIN_RATE_LIMIT=true and a tightened guard (5 attempts).',
    );

    await page.goto('/login');
    for (let i = 0; i < 6; i++) {
      await page.locator('input[type="email"]').fill('attacker@example.com');
      await page.locator('input[type="password"]').fill(`bad-pwd-${i}`);
      await page.locator('button[type="submit"]').click();
      await page.waitForLoadState('networkidle');
    }
    await expect(page.getByRole('alert').filter({ hasText: /muitas tentativas/i }).first()).toBeVisible();
  });

  test.fixme('email not verified → resend banner with button', async ({ page }) => {
    // Wire-up: seed a user with emailVerified=false and matching env
    // vars E2E_UNVERIFIED_EMAIL / E2E_UNVERIFIED_PASSWORD. Then:
    //   1. Submit credentials.
    //   2. Expect a banner whose text matches /email não verificado/i.
    //   3. Expect a "Reenviar verificação" button inside that banner.
    //   4. Click it; expect the banner text to swap to /email reenviado/i.
    expect(page).toBeDefined();
  });

  test.fixme('2FA enabled → two-step flow', async ({ page }) => {
    // Wire-up: seed a user with twoFactorEnabled=true and a known
    // TOTP secret (via E2E_2FA_SECRET). Use `authenticator.generate`
    // from `otplib` to compute the live code at test time. Steps:
    //   1. Submit email + password.
    //   2. Form transitions to two-factor phase (code input visible).
    //   3. Fill code; expect successful redirect.
    expect(page).toBeDefined();
  });
});
