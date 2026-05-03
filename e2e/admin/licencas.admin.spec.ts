import { expect, test } from '@playwright/test';

/**
 * E2E tests for /admin/developer/licencas — License & Key management.
 *
 * Requires: Next.js dev server on :3000, license-service on :4007.
 * Uses admin storageState (.auth/admin.json from setup project).
 */

test.describe('admin/developer/licencas', () => {
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
        !e.includes('WebSocket') &&
        !e.includes('socket.io'),
    );
    expect(fatal, `unexpected JS console errors: ${fatal.join(' | ')}`).toHaveLength(0);
  }

  async function gotoPage(page: Parameters<typeof test.beforeEach>[0]['page']) {
    await page.goto('/admin/developer/licencas');
    await page.locator('h1').filter({ hasText: /licen/i }).waitFor({ timeout: 12_000 });
  }

  // ──────────────────────────────────────────────────────────────────
  // 1. Page load
  // ──────────────────────────────────────────────────────────────────
  test('page loads: h1, stat cards, no redirect', async ({ page }) => {
    await gotoPage(page);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/perfil/);

    // Stat card labels (use .first() to avoid strict-mode ambiguity)
    await expect(page.getByText('Produtos').first()).toBeVisible();
    await expect(page.getByText('Tokens ativos').first()).toBeVisible();
    await expect(page.getByText('Revogados').first()).toBeVisible();
    await expect(page.getByText('Expirados').first()).toBeVisible();

    // Stat card values are numbers
    const cards = page.locator('.rounded-xl.border.bg-card .text-2xl');
    await expect(cards.first()).toBeVisible();

    assertNoJsErrors();
  });

  // ──────────────────────────────────────────────────────────────────
  // 2. Products section
  // ──────────────────────────────────────────────────────────────────
  test('products section: heading, table headers, filter input', async ({ page }) => {
    await gotoPage(page);

    await expect(page.getByRole('heading', { name: 'Produtos licenciados' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Novo produto' })).toBeVisible();

    // Table headers (only when rows exist)
    const thead = page.locator('thead').first();
    if (await thead.isVisible()) {
      await expect(thead.getByText('Nome')).toBeVisible();
      await expect(thead.getByText('App ID')).toBeVisible();
      await expect(thead.getByText('Criado em')).toBeVisible();
    }

    // Products filter input
    await expect(page.getByPlaceholder('Filtrar…')).toBeVisible();

    assertNoJsErrors();
  });

  // ──────────────────────────────────────────────────────────────────
  // 3. Create product dialog
  // ──────────────────────────────────────────────────────────────────
  test('create product dialog: opens, shows fields, cancels', async ({ page }) => {
    await gotoPage(page);

    await page.getByRole('button', { name: '+ Novo produto' }).click();

    // Dialog header
    await expect(page.getByRole('heading', { name: 'Novo produto licenciado' })).toBeVisible();

    // Form fields with actual placeholders
    await expect(page.getByPlaceholder('ex: SZDevs ERP')).toBeVisible();
    await expect(page.getByPlaceholder('ex: SZDevs-erp')).toBeVisible();
    await expect(page.getByPlaceholder('Descreva o produto brevemente')).toBeVisible();

    // Buttons
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar produto' })).toBeVisible();

    // Close
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { name: 'Novo produto licenciado' })).not.toBeVisible();

    assertNoJsErrors();
  });

  test('create product dialog: validation — spaces-only name shows error', async ({ page }) => {
    await gotoPage(page);

    await page.getByRole('button', { name: '+ Novo produto' }).click();
    await expect(page.getByPlaceholder('ex: SZDevs ERP')).toBeVisible();

    // Fill name with spaces (passes browser `required` but fails trim() check in handler)
    await page.getByPlaceholder('ex: SZDevs ERP').fill('   ');
    await page.getByPlaceholder('ex: SZDevs-erp').fill('test-app-id');
    await page.getByRole('button', { name: 'Criar produto' }).click();

    await expect(page.getByText(/nome e app id são obrigatórios/i)).toBeVisible({ timeout: 3_000 });

    await page.getByRole('button', { name: 'Cancelar' }).click();
    assertNoJsErrors();
  });

  test('create product: submits and product count increases', async ({ page }) => {
    await gotoPage(page);

    const statCard = page.locator('.rounded-xl.border.bg-card').filter({ hasText: 'Produtos' }).first();
    const prevCountText = await statCard.locator('.text-2xl').textContent();
    const prevCount = parseInt(prevCountText ?? '0', 10);

    await page.getByRole('button', { name: '+ Novo produto' }).click();

    const ts = Date.now();
    await page.getByPlaceholder('ex: SZDevs ERP').fill(`E2E Prod ${ts}`);
    await page.getByPlaceholder('ex: SZDevs-erp').fill(`e2e-${ts}`);
    await page.getByPlaceholder('Descreva o produto brevemente').fill('Created by E2E test');

    await page.getByRole('button', { name: 'Criar produto' }).click();

    await expect(page.getByRole('heading', { name: 'Novo produto licenciado' })).not.toBeVisible({ timeout: 10_000 });

    await page.waitForTimeout(1500);
    const newCountText = await statCard.locator('.text-2xl').textContent();
    expect(parseInt(newCountText ?? '0', 10)).toBeGreaterThan(prevCount);

    await expect(page.locator('td').filter({ hasText: `E2E Prod ${ts}` }).first()).toBeVisible();

    assertNoJsErrors();
  });

  // ──────────────────────────────────────────────────────────────────
  // 4. Generate token wizard
  // ──────────────────────────────────────────────────────────────────
  test('generate key button visible when products+clients exist', async ({ page }) => {
    await gotoPage(page);
    await expect(page.getByRole('button', { name: '+ Gerar key de ativação' })).toBeVisible({ timeout: 5_000 });
    assertNoJsErrors();
  });

  test('wizard step 1: opens, requires product+client selection', async ({ page }) => {
    await gotoPage(page);

    await page.getByRole('button', { name: '+ Gerar key de ativação' }).click();

    await expect(page.getByRole('heading', { name: 'Gerar key de ativação' })).toBeVisible();
    await expect(page.getByText('1. Produto & Cliente')).toBeVisible();

    const selects = page.locator('select');
    await expect(selects.first()).toBeVisible();

    const nextBtn = page.getByRole('button', { name: 'Próximo' });
    await expect(nextBtn).toBeDisabled();

    await selects.first().selectOption({ index: 1 });
    await selects.nth(1).selectOption({ index: 1 });
    await expect(nextBtn).toBeEnabled();

    await page.getByLabel('Fechar').click();
    assertNoJsErrors();
  });

  test('wizard step 2: token options fields', async ({ page }) => {
    await gotoPage(page);

    await page.getByRole('button', { name: '+ Gerar key de ativação' }).click();

    await page.locator('select').first().selectOption({ index: 1 });
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Próximo' }).click();

    await expect(page.getByText('2. Configurações')).toBeVisible({ timeout: 6_000 });
    await expect(page.getByText('Máx. de ativações')).toBeVisible();
    await expect(page.getByText('Validade (data)')).toBeVisible();
    await expect(page.getByText('Hardware ID (opcional)')).toBeVisible();
    await expect(page.getByPlaceholder('Ilimitado')).toBeVisible();
    await expect(page.getByPlaceholder(/AA:BB:CC/)).toBeVisible();

    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page.getByText('1. Produto & Cliente')).toBeVisible();

    await page.getByLabel('Fechar').click();
    assertNoJsErrors();
  });

  test('wizard step 3: billing toggle', async ({ page }) => {
    await gotoPage(page);

    await page.getByRole('button', { name: '+ Gerar key de ativação' }).click();

    await page.locator('select').first().selectOption({ index: 1 });
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Próximo' }).click();
    await expect(page.getByText('2. Configurações')).toBeVisible({ timeout: 6_000 });
    await page.getByRole('button', { name: 'Próximo' }).click();

    await expect(page.getByText('3. Cobrança')).toBeVisible({ timeout: 6_000 });
    await expect(page.getByText('Gerar cobrança ao emitir a key')).toBeVisible();

    // Price hidden initially
    await expect(page.getByPlaceholder('0,00')).not.toBeVisible();

    // Toggle billing ON
    await page.locator('input[type="checkbox"]').click();

    await expect(page.getByText('Valor (R$) *')).toBeVisible();
    await expect(page.getByText('Vencimento (dias)')).toBeVisible();
    await expect(page.getByText('Avulso')).toBeVisible();
    await expect(page.getByText('Assinatura / Recorrente')).toBeVisible();

    const gerarBtn = page.getByRole('button', { name: 'Gerar key' });
    await expect(gerarBtn).toBeDisabled();

    await page.getByPlaceholder('0,00').fill('149.90');
    await expect(gerarBtn).toBeEnabled();

    await page.getByLabel('Fechar').click();
    assertNoJsErrors();
  });

  // ──────────────────────────────────────────────────────────────────
  // 5. Token table filters
  // ──────────────────────────────────────────────────────────────────
  test('tokens section: search and filter controls', async ({ page }) => {
    await gotoPage(page);

    await expect(page.getByRole('heading', { name: 'Tokens de ativação' })).toBeVisible();
    await expect(page.getByPlaceholder('Buscar key ou cliente…')).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: 'Todos produtos' })).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: 'Todos status' })).toBeVisible();

    // Search filters results
    await page.getByPlaceholder('Buscar key ou cliente…').fill('XYZXYZ-no-match');
    await expect(page.getByText('Nenhum token encontrado para os filtros aplicados.')).toBeVisible();

    await page.getByPlaceholder('Buscar key ou cliente…').fill('');
    assertNoJsErrors();
  });

  test('tokens section: status filter options', async ({ page }) => {
    await gotoPage(page);

    // Options inside a <select> are hidden by browser default; verify via JS
    const statusSelect = page.getByRole('combobox').filter({ hasText: 'Todos status' });
    await expect(statusSelect).toBeVisible();
    const optionValues = await statusSelect.evaluate((el: HTMLSelectElement) =>
      Array.from(el.options).map((o) => o.text),
    );
    expect(optionValues).toContain('Todos status');
    expect(optionValues).toContain('Ativos');
    expect(optionValues).toContain('Revogados');
    expect(optionValues).toContain('Expirados');

    assertNoJsErrors();
  });

  // ──────────────────────────────────────────────────────────────────
  // 6. Nav entry
  // ──────────────────────────────────────────────────────────────────
  test('nav: Licenças & Keys link visible in admin/developer sidebar', async ({ page }) => {
    await page.goto('/admin/developer');
    await expect(page.locator('a[href="/admin/developer/licencas"]')).toBeVisible({ timeout: 10_000 });
    assertNoJsErrors();
  });

  // ──────────────────────────────────────────────────────────────────
  // 7. Auth guard
  // ──────────────────────────────────────────────────────────────────
  test('auth guard: unauthenticated → /login', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000/admin/developer/licencas');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await ctx.close();
  });

  // ──────────────────────────────────────────────────────────────────
  // 8. Full flow: generate token
  // ──────────────────────────────────────────────────────────────────
  test('full flow: generate token → key in step 4 result', async ({ page }) => {
    await gotoPage(page);

    const generateBtn = page.getByRole('button', { name: '+ Gerar key de ativação' });
    if (!(await generateBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await generateBtn.click();

    // Step 1: select product + client, check bind
    await page.locator('select').first().selectOption({ index: 1 });
    await page.locator('select').nth(1).selectOption({ index: 1 });
    // Ensure client is bound to product
    await page.locator('input[type="checkbox"]').first().check();
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Step 2: defaults → next
    await expect(page.getByText('2. Configurações')).toBeVisible({ timeout: 6_000 });
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Step 3: no billing → Gerar key
    await expect(page.getByText('3. Cobrança')).toBeVisible({ timeout: 6_000 });
    await page.getByRole('button', { name: 'Gerar key' }).click();

    // Step 4: result
    await expect(page.getByText(/key gerada com sucesso/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Chave de ativação')).toBeVisible();
    await expect(page.getByText('Hash SHA-256').first()).toBeVisible();
    await expect(page.getByText('⚠ Guarde a chave agora.')).toBeVisible();
    await expect(page.getByText('Copiar').first()).toBeVisible();

    // Close — use last() because ✕ also has aria-label "Fechar"
    await page.getByRole('button', { name: 'Fechar' }).last().click();
    await expect(page.getByRole('heading', { name: 'Gerar key de ativação' })).not.toBeVisible({ timeout: 5_000 });

    // Active token count > 0
    await page.waitForTimeout(1500);
    const activeCard = page.locator('.rounded-xl.border.bg-card').filter({ hasText: 'Tokens ativos' }).first();
    const countText = await activeCard.locator('.text-2xl').textContent();
    expect(parseInt(countText ?? '0', 10)).toBeGreaterThan(0);

    assertNoJsErrors();
  });

  // ──────────────────────────────────────────────────────────────────
  // 9. Token row expand
  // ──────────────────────────────────────────────────────────────────
  test('token row expand: hash and hardware details visible', async ({ page }) => {
    await gotoPage(page);

    // Tokens table is the last table on the page (products table comes first)
    const firstDataRow = page.locator('tbody').last().locator('tr').first();
    if (!(await firstDataRow.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    // Click on the product name cell (first td) — avoids action column stopPropagation
    const productCell = firstDataRow.locator('td').first();
    await productCell.click();

    await expect(page.getByText('Hash SHA-256').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Hardware ID').first()).toBeVisible();

    // Click again to collapse
    await productCell.click();
    await page.waitForTimeout(400);
    await expect(page.locator('tr').filter({ hasText: 'Hash SHA-256' })).toHaveCount(0, { timeout: 3_000 });

    assertNoJsErrors();
  });

  // ──────────────────────────────────────────────────────────────────
  // 10. Revoke token dialog
  // ──────────────────────────────────────────────────────────────────
  test('revoke dialog: opens, shows fields, invoice toggle, cancels', async ({ page }) => {
    await gotoPage(page);

    const revokeBtn = page.getByRole('button', { name: 'Revogar' }).first();
    if (!(await revokeBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await revokeBtn.click();

    await expect(page.getByRole('heading', { name: 'Revogar token' })).toBeVisible();
    await expect(page.getByText('Produto').first()).toBeVisible();
    await expect(page.getByText('Key (prefixo)').first()).toBeVisible();
    await expect(page.getByPlaceholder(/cancelamento de contrato/i)).toBeVisible();
    await expect(page.getByText('Cancelar assinatura / fatura associada')).toBeVisible();

    // Toggle invoice cancellation
    await page.locator('input[type="checkbox"]').last().check();
    await expect(page.getByPlaceholder(/ex.*clu3k2/i)).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { name: 'Revogar token' })).not.toBeVisible();

    assertNoJsErrors();
  });

  test('revoke flow: token revoked, success message shown', async ({ page }) => {
    await gotoPage(page);

    const revokeBtn = page.getByRole('button', { name: 'Revogar' }).first();
    if (!(await revokeBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await revokeBtn.click();
    await page.getByPlaceholder(/cancelamento de contrato/i).fill('Teste E2E — revogação');
    await page.getByRole('button', { name: 'Revogar token' }).click();

    // Success message — router.refresh() now happens only after Fechar click
    await expect(page.getByText('✓ Token revogado com sucesso.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Revogar token' })).toBeVisible();

    await page.getByRole('button', { name: 'Fechar' }).last().click();
    await expect(page.getByRole('heading', { name: 'Revogar token' })).not.toBeVisible();

    // Revogados count > 0
    await page.waitForTimeout(1500);
    const revokedCard = page.locator('.rounded-xl.border.bg-card').filter({ hasText: 'Revogados' }).first();
    const countText = await revokedCard.locator('.text-2xl').textContent();
    expect(parseInt(countText ?? '0', 10)).toBeGreaterThan(0);

    assertNoJsErrors();
  });
});
