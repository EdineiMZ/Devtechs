import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on('console', (m) => console.log(`[c.${m.type()}]`, m.text().slice(0, 300)));
  page.on('pageerror', (e) => console.log('[pageerr]', e.message));
  page.on('response', async (r) => {
    if (
      r.url().includes('/api/auth/callback/credentials') ||
      r.url().includes('/auth/login') ||
      r.url().includes('/api/auth/error')
    ) {
      let body = await r.text().catch(() => '');
      console.log('[net]', r.request().method(), r.url(), '->', r.status(), '::', body.slice(0, 200));
    }
  });

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

  // Force re-fetch by hard reload (bypasses module cache for the page)
  await page.reload({ waitUntil: 'networkidle' });

  await page.locator('input[type="email"]').first().fill('admin@devtechs.com');
  await page.locator('input[type="password"]').first().fill('Admin@DevTechs2026');

  // Inspect React Hook Form state by stepping into the form
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      console.log('FORM noValidate:', form.noValidate);
      console.log('FORM has onsubmit:', !!form.onsubmit);
    }
  });

  // Try clicking and capturing the resulting alert state
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(3000);

  // Print out every role=alert text and every input's aria-invalid
  const alerts = await page.locator('[role="alert"]').all();
  console.log('alerts count:', alerts.length);
  for (const a of alerts) {
    console.log('  alert text:', JSON.stringify(await a.innerText()));
  }
  const inputs = await page.locator('input').all();
  for (const i of inputs) {
    const name = await i.getAttribute('name');
    const invalid = await i.getAttribute('aria-invalid');
    const errId = await i.getAttribute('aria-describedby');
    console.log('  input', name, 'invalid=', invalid, 'errId=', errId);
  }

  // Submit again via direct form.requestSubmit to be sure
  console.log('--- direct form.requestSubmit ---');
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) form.requestSubmit();
  });
  await page.waitForTimeout(3000);
  console.log('URL now:', page.url());

  await browser.close();
})().catch((e) => console.error(e));
