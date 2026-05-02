import { expect, test } from '@playwright/test';

/**
 * Smoke tests for all admin module dashboard pages.
 *
 * Runs as the `admin` Playwright project, which injects `.auth/admin.json`
 * as the storage state (produced by `e2e/fixtures/auth.setup.ts`). Every
 * test simply navigates to the module root and asserts:
 *   1. No hard redirect to /login or /perfil (auth guard passed).
 *   2. The page-level <h1> is visible (the shell rendered without crashing).
 *   3. No uncaught JS error is left in the console (no error boundary hit).
 *
 * Sub-page smoke tests (employee list, kanban, pipelines, etc.) follow the
 * same pattern and are grouped inside the same describe block so they share
 * the per-describe console-error listener.
 *
 * Services must be running for full data rendering, but the assertions are
 * intentionally loose — we check for the heading text, not for real rows,
 * so the suite stays green even when backend services are down (they return
 * an empty state which the pages handle gracefully).
 */

test.describe('admin/modules smoke', () => {
  // Collect console errors for the assertions at the end of each test.
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
        // Ignore expected network errors when backend services are down in
        // CI / local dev without the full stack running.
        !e.includes('fetch failed') &&
        !e.includes('ECONNREFUSED') &&
        !e.includes('Failed to load resource') &&
        // Ignore hydration-time warnings (not fatal).
        !e.includes('Hydration') &&
        !e.includes('hydrat'),
    );
    expect(fatal, `unexpected JS console errors: ${fatal.join(' | ')}`).toHaveLength(0);
  }

  // ------------------------------------------------------------------
  // /admin — root dashboard
  // ------------------------------------------------------------------
  test('admin root: loads without error', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/perfil/);
    // The admin page has a visible heading (varies by implementation).
    await expect(page.locator('h1').first()).toBeVisible();
    assertNoJsErrors();
  });

  // ------------------------------------------------------------------
  // RH module
  // ------------------------------------------------------------------
  test('admin/rh: dashboard loads', async ({ page }) => {
    await page.goto('/admin/rh');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /rh|recursos humanos/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  test('admin/rh/funcionarios: employee list loads', async ({ page }) => {
    await page.goto('/admin/rh/funcionarios');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /funcion/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  test('admin/rh/ferias: vacation requests load', async ({ page }) => {
    await page.goto('/admin/rh/ferias');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /f[eé]rias/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  test('admin/rh/escalas: work schedules load', async ({ page }) => {
    await page.goto('/admin/rh/escalas');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /escala/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  // ------------------------------------------------------------------
  // Financeiro module
  // ------------------------------------------------------------------
  test('admin/financeiro: dashboard loads', async ({ page }) => {
    await page.goto('/admin/financeiro');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /financeiro/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  test('admin/financeiro/transacoes: transaction list loads', async ({ page }) => {
    await page.goto('/admin/financeiro/transacoes');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /transa/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  test('admin/financeiro/faturas: invoice list loads', async ({ page }) => {
    await page.goto('/admin/financeiro/faturas');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /fatura/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  test('admin/financeiro/dre: DRE loads', async ({ page }) => {
    await page.goto('/admin/financeiro/dre');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /dre|demonstrat/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  // ------------------------------------------------------------------
  // Projetos module
  // ------------------------------------------------------------------
  test('admin/projetos: project grid loads', async ({ page }) => {
    await page.goto('/admin/projetos');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /projeto/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  // ------------------------------------------------------------------
  // DevOps module
  // ------------------------------------------------------------------
  test('admin/devops: dashboard loads', async ({ page }) => {
    await page.goto('/admin/devops');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /devops/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  test('admin/devops/pipelines: pipeline list loads', async ({ page }) => {
    await page.goto('/admin/devops/pipelines');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /pipeline/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  test('admin/devops/deploys: deploy history loads', async ({ page }) => {
    await page.goto('/admin/devops/deploys');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /deploy|implanta/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  test('admin/devops/logs: log stream page loads', async ({ page }) => {
    await page.goto('/admin/devops/logs');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /log/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  // ------------------------------------------------------------------
  // Developer module
  // ------------------------------------------------------------------
  test('admin/developer: dashboard loads', async ({ page }) => {
    await page.goto('/admin/developer');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').first()).toBeVisible();
    assertNoJsErrors();
  });

  test('admin/developer/logs: log viewer loads', async ({ page }) => {
    await page.goto('/admin/developer/logs');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').first()).toBeVisible();
    assertNoJsErrors();
  });

  test('admin/developer/queues: queue monitor loads', async ({ page }) => {
    await page.goto('/admin/developer/queues');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').first()).toBeVisible();
    assertNoJsErrors();
  });

  // ------------------------------------------------------------------
  // Configurações module
  // ------------------------------------------------------------------
  test('admin/configuracoes: index loads', async ({ page }) => {
    await page.goto('/admin/configuracoes');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /configura/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  test('admin/configuracoes/papeis: roles list loads', async ({ page }) => {
    await page.goto('/admin/configuracoes/papeis');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /pap[eé]/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  test('admin/configuracoes/permissoes: permissions matrix loads', async ({ page }) => {
    await page.goto('/admin/configuracoes/permissoes');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /permiss/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  test('admin/configuracoes/auditoria: audit log loads', async ({ page }) => {
    await page.goto('/admin/configuracoes/auditoria');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /audit/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  test('admin/configuracoes/usuarios: user list loads', async ({ page }) => {
    await page.goto('/admin/configuracoes/usuarios');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('h1').filter({ hasText: /usu[aá]/i }).first()).toBeVisible();
    assertNoJsErrors();
  });

  // ------------------------------------------------------------------
  // Auth guard: unauthenticated access redirects to /login
  // ------------------------------------------------------------------
  test('auth guard: unauthenticated request → /login redirect', async ({ browser }) => {
    // Fresh context with no stored credentials.
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();

    await page.goto('/admin/rh');
    await expect(page).toHaveURL(/\/login/);

    await ctx.close();
  });

  // ------------------------------------------------------------------
  // Permission guard: client (no admin permissions) → /perfil
  // ------------------------------------------------------------------
  test.fixme(
    'permission guard: client without admin perms → /perfil',
    async ({ browser }) => {
      // Wire-up: requires CLIENT storageState to be populated. Once the
      // client seed account is available this becomes a live test.
      //   const ctx = await browser.newContext({ storageState: '.auth/client.json' });
      //   const page = await ctx.newPage();
      //   await page.goto('/admin/rh');
      //   await expect(page).toHaveURL(/\/perfil/);
      //   await ctx.close();
      expect(browser).toBeDefined();
    },
  );
});
