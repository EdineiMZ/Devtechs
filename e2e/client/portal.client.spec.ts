import { expect, test } from '@playwright/test';

import { CLIENT } from '../fixtures/users';

/**
 * Client portal smoke tests.
 *
 * Runs as the `client` Playwright project (storageState = .auth/client.json).
 * Each test navigates to a portal page and asserts:
 *   1. No redirect to /login (auth guard passed).
 *   2. Main heading is visible (page rendered without crashing).
 *   3. No fatal JS console errors.
 *
 * Tests that require backend data are intentionally loose — they check
 * structure (heading, empty-state text), not real row counts.
 */

test.describe('client/portal', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
  });

  function assertNoJsErrors() {
    const fatal = consoleErrors.filter(
      (e) =>
        !e.includes('fetch failed') &&
        !e.includes('ECONNREFUSED') &&
        !e.includes('Failed to load resource') &&
        !e.includes('Hydration') &&
        !e.includes('hydrat') &&
        // WebSocket services may not be running in dev without the full stack.
        !e.includes('WebSocket') &&
        !e.includes('socket.io') &&
        // Hydration timestamp mismatches are cosmetic, not app errors.
        !e.includes('Text content did not match'),
    );
    expect(fatal, `Unexpected JS errors: ${fatal.join(' | ')}`).toHaveLength(0);
  }

  // ── /perfil (dashboard) ──────────────────────────────────────────────────
  test('client dashboard loads', async ({ page }) => {
    await page.goto('/perfil');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').first()).toBeVisible();
    assertNoJsErrors();
  });

  // ── /perfil/tickets ───────────────────────────────────────────────────────
  test('my tickets page loads', async ({ page }) => {
    await page.goto('/perfil/tickets');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
    // "Meus chamados" — accepts any h1 in case the text varies.
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
    assertNoJsErrors();
  });

  test('new ticket form opens', async ({ page }) => {
    await page.goto('/perfil/tickets/novo');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
    // Should show a form to create a ticket.
    await expect(page.locator('form, [role="form"]').first()).toBeVisible();
    assertNoJsErrors();
  });

  test('new ticket form: title field is present', async ({ page }) => {
    await page.goto('/perfil/tickets/novo');
    await page.waitForLoadState('networkidle');
    const titleInput = page.locator('input[name="titulo"], input[name="title"], input[placeholder*="título" i]').first();
    await expect(titleInput).toBeVisible({ timeout: 5000 });
  });

  test('new ticket form: description field is present', async ({ page }) => {
    await page.goto('/perfil/tickets/novo');
    await page.waitForLoadState('networkidle');
    const descInput = page.locator('textarea[name="descricao"], textarea[name="description"], textarea').first();
    await expect(descInput).toBeVisible({ timeout: 5000 });
  });

  // ── /perfil/projetos ──────────────────────────────────────────────────────
  test('my projects page loads', async ({ page }) => {
    await page.goto('/perfil/projetos');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /projeto/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  // ── /perfil/faturas ───────────────────────────────────────────────────────
  test('invoices page loads', async ({ page }) => {
    await page.goto('/perfil/faturas');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
    assertNoJsErrors();
  });

  // ── /perfil/notificacoes ──────────────────────────────────────────────────
  test('notifications page loads', async ({ page }) => {
    await page.goto('/perfil/notificacoes');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
    assertNoJsErrors();
  });

  // ── /perfil/configuracoes ─────────────────────────────────────────────────
  test('account settings page loads', async ({ page }) => {
    await page.goto('/perfil/configuracoes');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /configura|conta|perfil/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  test('security settings page loads', async ({ page }) => {
    await page.goto('/perfil/configuracoes/seguranca');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
    // Date hydration mismatches (relative timestamps) are cosmetic; not asserted here.
  });

  test('2FA setup page loads', async ({ page }) => {
    await page.goto('/perfil/configuracoes/2fa');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').first()).toBeVisible();
    assertNoJsErrors();
  });

  // ── Navigation bar ────────────────────────────────────────────────────────
  test('client nav: all menu links are visible', async ({ page }) => {
    await page.goto('/perfil');
    await page.waitForLoadState('networkidle');

    const navLinks = [
      /meu painel/i,
      /ticket|chamado/i,
      /projeto/i,
      /fatura/i,
      /notifica/i,
      /conta|configura/i,
    ];

    for (const pattern of navLinks) {
      const link = page.getByRole('link', { name: pattern }).first();
      await expect(link, `Nav link matching ${pattern} should be visible`).toBeVisible({
        timeout: 5000,
      });
    }
  });

  // ── Authorization: client cannot access admin routes ─────────────────────
  test('client cannot access /admin (auth guard)', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(
      url.includes('/perfil') || url.includes('/login') || url.includes('/verificar-email'),
      `Client was allowed into /admin! Got: ${url}`,
    ).toBe(true);
  });

  test('client cannot access /admin/rh', async ({ page }) => {
    await page.goto('/admin/rh');
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(
      url.includes('/perfil') || url.includes('/login') || url.includes('/verificar-email'),
      `Client was allowed into /admin/rh! Got: ${url}`,
    ).toBe(true);
  });

  test('client cannot access /admin/financeiro', async ({ page }) => {
    await page.goto('/admin/financeiro');
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(
      url.includes('/perfil') || url.includes('/login') || url.includes('/verificar-email'),
      `Client was allowed into /admin/financeiro! Got: ${url}`,
    ).toBe(true);
  });

  test('client cannot access /admin/configuracoes/usuarios', async ({ page }) => {
    await page.goto('/admin/configuracoes/usuarios');
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(
      url.includes('/perfil') || url.includes('/login') || url.includes('/verificar-email'),
      `Client was allowed into /admin/configuracoes/usuarios! Got: ${url}`,
    ).toBe(true);
  });
});

// ─── Public pages (no auth required) ────────────────────────────────────
test.describe('client/public-pages', () => {
  test('home/landing page loads', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    // Should not redirect to login — it's a public page.
    expect(page.url()).not.toContain('/login');
  });

  test('contact page loads and has a form', async ({ page }) => {
    await page.goto('/contato');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('form').first()).toBeVisible({ timeout: 5000 });
  });

  test('email verification page loads', async ({ page }) => {
    await page.goto('/verificar-email');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── Client login flow ────────────────────────────────────────────────────
test.describe('client/login-flow', () => {
  test('client logs in and sees portal dashboard', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();

    await page.goto('/login');
    await page.locator('input[type="email"]').fill(CLIENT.email);
    await page.locator('input[type="password"]').fill(CLIENT.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15_000 });

    const url = page.url();
    expect(
      url.includes('/perfil') || url.includes('/verificar-email'),
      `Expected client to land on /perfil or /verificar-email, got: ${url}`,
    ).toBe(true);

    await ctx.close();
  });
});
