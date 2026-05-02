import { expect, test } from '@playwright/test';

/**
 * Register page coverage. The flow is:
 *   /register → POST /auth/register on auth-service → user is created
 *   with status=ACTIVE, emailVerified=false, then redirected to
 *   /verificar-email (middleware bounces unverified users).
 */

function uniqueEmail(): string {
  // Avoid collisions across reruns; keep a stable domain so the seed
  // isn't polluted with random subdomains.
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1000)}@devtechs.test`;
}

test.describe('auth/register', () => {
  test('valid form → user created, redirected to verify-email', async ({ page }) => {
    const email = uniqueEmail();
    await page.goto('/register');
    await page.locator('input[name="nome"], input[name="name"]').first().fill('E2E Tester');
    await page.locator('input[type="email"]').fill(email);
    const password = page.locator('input[name="password"]').first();
    const confirm = page.locator('input[name="confirmPassword"]').first();
    await password.fill('Strong@Pwd2026');
    await confirm.fill('Strong@Pwd2026');

    await page.locator('button[type="submit"]').click();

    // Success renders an in-place view (URL stays at /register) with h2
    // "Verifique seu email". Alternatively the server may redirect to
    // /verificar-email.
    await Promise.race([
      page.locator('h2').filter({ hasText: /verifique seu email/i }).first()
        .waitFor({ state: 'visible', timeout: 15_000 }),
      page.waitForURL((u) => /verificar-email|login/.test(u.toString()), { timeout: 15_000 }),
    ]);
  });

  test('mismatched passwords → inline validation error', async ({ page }) => {
    await page.goto('/register');
    await page.locator('input[name="nome"], input[name="name"]').first().fill('E2E Tester');
    await page.locator('input[type="email"]').fill(uniqueEmail());
    await page.locator('input[name="password"]').first().fill('Strong@Pwd2026');
    await page.locator('input[name="confirmPassword"]').first().fill('Different@2026');
    await page.locator('button[type="submit"]').click();

    // Schema rule: confirmPassword must equal password.
    await expect(
      page.getByText(/senhas não conferem|password.*do not match/i).first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test('weak password (no uppercase) → inline error', async ({ page }) => {
    await page.goto('/register');
    await page.locator('input[name="nome"], input[name="name"]').first().fill('E2E Tester');
    await page.locator('input[type="email"]').fill(uniqueEmail());
    await page.locator('input[name="password"]').first().fill('weakpassword2026');
    await page.locator('input[name="confirmPassword"]').first().fill('weakpassword2026');
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText(/letra maiúscula/i).first()).toBeVisible();
  });

  test('duplicate email → server-side error', async ({ page }) => {
    await page.goto('/register');
    await page.locator('input[name="nome"], input[name="name"]').first().fill('Admin Dup');
    await page.locator('input[type="email"]').fill('admin@devtechs.com');
    await page.locator('input[name="password"]').first().fill('Strong@Pwd2026');
    await page.locator('input[name="confirmPassword"]').first().fill('Strong@Pwd2026');
    await page.locator('button[type="submit"]').click();

    // Auth-service returns 409 on duplicate email. The form maps it
    // to a top-level banner.
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });
});
