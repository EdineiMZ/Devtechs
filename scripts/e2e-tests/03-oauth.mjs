/**
 * Test 3: OAuth button visibility driven by /api/auth/available-providers.
 *
 * This test does NOT perform a real OAuth round-trip (that requires a live
 * browser session authenticated with Google/GitHub). It verifies:
 *
 *   1. GET /api/auth/available-providers returns a valid JSON object with
 *      `google` and `github` boolean fields — never leaks credential values.
 *   2. When a provider flag is `false` the corresponding button is absent
 *      from the /login page DOM.
 *   3. When a provider flag is `true` the corresponding button is present
 *      and visible on /login.
 *   4. When NEITHER provider is configured the "ou" separator div is also
 *      hidden (the whole OAuth section is suppressed).
 *
 * The test reads the live /api/auth/available-providers response to determine
 * which assertions to make, so it works correctly in any environment
 * regardless of whether OAuth credentials are configured or not.
 */
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`${tag} :: ${name}${detail ? ` :: ${detail}` : ''}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // ── 1. Probe /api/auth/available-providers ────────────────────────────
  const provRes = await page.request.get(`${BASE}/api/auth/available-providers`);
  record(
    'GET /api/auth/available-providers returns 200',
    provRes.status() === 200,
    `status=${provRes.status()}`,
  );

  const body = await provRes.json().catch(() => null);
  record(
    'response has boolean `google` field',
    body !== null && typeof body.google === 'boolean',
    JSON.stringify(body),
  );
  record(
    'response has boolean `github` field',
    body !== null && typeof body.github === 'boolean',
    JSON.stringify(body),
  );

  // Credential values must never appear in the response body.
  const rawText = await provRes.text().catch(() => '');
  record(
    'response does not contain raw credential values',
    !rawText.includes('CLIENT_ID') && !rawText.includes('CLIENT_SECRET'),
    `body=${rawText.slice(0, 200)}`,
  );

  // ── 2. Verify /login button visibility matches provider flags ──────────
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });

  // OAuthButtons fetches available-providers on mount then renders.
  // Give it time to hydrate and update the DOM.
  await page.waitForTimeout(1500);

  const googleEnabled = body?.google === true;
  const githubEnabled = body?.github === true;
  const anyEnabled = googleEnabled || githubEnabled;

  const googleBtn = page.locator('button', { hasText: /^Google$/i });
  const githubBtn = page.locator('button', { hasText: /^GitHub$/i });

  if (googleEnabled) {
    record(
      'Google button visible when google=true',
      await googleBtn.isVisible().catch(() => false),
    );
  } else {
    record(
      'Google button absent when google=false',
      (await googleBtn.count()) === 0,
    );
  }

  if (githubEnabled) {
    record(
      'GitHub button visible when github=true',
      await githubBtn.isVisible().catch(() => false),
    );
  } else {
    record(
      'GitHub button absent when github=false',
      (await githubBtn.count()) === 0,
    );
  }

  // ── 3. "ou" separator visibility ──────────────────────────────────────
  // The separator lives inside OAuthButtons and is only rendered when at
  // least one provider is active.
  const orSeparator = page.locator('span', { hasText: /^ou$/i });
  if (anyEnabled) {
    record(
      '"ou" separator visible when at least one provider is configured',
      await orSeparator.isVisible().catch(() => false),
    );
  } else {
    record(
      '"ou" separator hidden when no providers are configured',
      (await orSeparator.count()) === 0,
    );
  }

  // ── 4. Clicking an active provider initiates the OAuth redirect ────────
  if (googleEnabled) {
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/auth/') && r.request().method() !== 'GET',
        { timeout: 5000 },
      ).catch(() => null),
      googleBtn.click(),
    ]);
    record(
      'Clicking Google button triggers an auth-related request',
      response !== null || page.url().includes('/api/auth/'),
      `url=${page.url()}`,
    );
    // Navigate back for any further checks
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }).catch(() => {});
  }

  if (githubEnabled) {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/auth/') && r.request().method() !== 'GET',
        { timeout: 5000 },
      ).catch(() => null),
      githubBtn.click(),
    ]);
    record(
      'Clicking GitHub button triggers an auth-related request',
      response !== null || page.url().includes('/api/auth/'),
      `url=${page.url()}`,
    );
  }

  await browser.close();

  // ── Summary ─────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    console.error('Failed:', failed.map((r) => r.name).join(', '));
    process.exit(1);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
