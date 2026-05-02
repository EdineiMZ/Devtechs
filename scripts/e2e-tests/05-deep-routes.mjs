/**
 * Test 5: After login, attempt to navigate to nav-config routes and see what's there.
 * Maps real implementation gaps in the web app.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const NAV_ROUTES = [
  '/perfil',
  '/perfil/tickets',
  '/perfil/faturas',
  '/perfil/notificacoes',
  '/perfil/configuracoes',
  '/admin',
  '/admin/rh',
  '/admin/financeiro',
  '/admin/projetos',
  '/admin/suporte',
  '/admin/devops',
  '/admin/developer',
  '/admin/configuracoes',
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // login first
  await page.goto(`${BASE}/login`);
  await page.locator('input[type="email"]').first().fill('admin@devtechs.com');
  await page.locator('input[type="password"]').first().fill('Admin@DevTechs2026');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 10000 });

  console.log('Logged in. Probing routes:');
  for (const route of NAV_ROUTES) {
    const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' }).catch(() => null);
    const status = resp?.status() ?? 0;
    const text = await page.locator('body').innerText().catch(() => '');
    const has404 = /404|This page could not be found/i.test(text);
    console.log(`  ${route} -> status=${status} ${has404 ? '[404 PAGE]' : ''} (final=${page.url()})`);
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
