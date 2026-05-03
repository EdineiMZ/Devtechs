/**
 * Trace what happens on form submit â€” full request/response logging.
 */
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on('console', (m) => console.log(`[console.${m.type()}]`, m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('requestfailed', (r) =>
    console.log('[requestfailed]', r.method(), r.url(), '->', r.failure()?.errorText),
  );
  page.on('response', async (r) => {
    const u = r.url();
    if (u.includes('/api/auth/') || u.includes('/auth/login')) {
      let body;
      try {
        body = await r.text();
        if (body.length > 200) body = body.slice(0, 200) + '...';
      } catch {
        body = '<unreadable>';
      }
      console.log(`[net] ${r.request().method()} ${u} -> ${r.status()} :: ${body}`);
    }
  });

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill('admin@SZDevs.com');
  await page.locator('input[type="password"]').first().fill('Admin@SZDevs2026');

  // Inject a wrapper around signIn to capture the result
  await page.evaluate(() => {
    window.__signInResults = [];
  });

  // Directly invoke the form submit handler bound to the form element
  const before = page.url();
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(4000);
  const after = page.url();
  console.log(`URL: ${before} -> ${after}`);

  // Read banner state
  const banners = await page.locator('[role="alert"], [role="status"]').allInnerTexts();
  console.log('banners:', JSON.stringify(banners));

  // Cookies
  const cookies = await ctx.cookies();
  console.log(
    'cookies:',
    cookies.filter((c) => c.name.includes('auth') || c.name.includes('session')).map((c) => c.name),
  );

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
