import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the DevTechs monorepo.
 *
 * Layout
 * ------
 * - All E2E specs live under `e2e/` at the repo root (cross-app concern).
 * - Fixtures: `e2e/fixtures/users.ts` lists test accounts per role and
 *   `e2e/fixtures/auth.setup.ts` performs a one-time login per role and
 *   saves the session cookie to JSON files under `.auth/`.
 *
 * Projects
 * --------
 * `setup` runs first (no auth) and writes the storage-state files.
 * Every other project depends on `setup` and reuses one of those files
 * via `storageState`. This avoids re-logging in for every test, which
 * is the single biggest cost driver in an auth-heavy suite.
 *
 * Reuse of the dev server
 * -----------------------
 * `webServer` is opt-in. By default the runner assumes the dev stack is
 * already up (it is, when you run `pnpm dev:full` in another terminal).
 * Set PLAYWRIGHT_AUTOSTART=1 to have Playwright boot `pnpm dev:web`
 * itself and tear it down at the end. CI typically wants AUTOSTART, dev
 * loops typically don't.
 *
 * Retries
 * -------
 * `process.env.CI ? 2 : 0` — local runs don't retry so flaky tests show
 * their flakiness on the first run. CI retries twice to absorb the
 * network/DNS hiccups that have nothing to do with the code under test.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const AUTOSTART = process.env.PLAYWRIGHT_AUTOSTART === '1';

export default defineConfig({
  testDir: './e2e',
  // `*.setup.ts` is matched too because the auth setup project lives
  // alongside the specs.
  testMatch: /.*\.(spec|setup)\.ts/,
  outputDir: 'test-results/playwright',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 2,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'test-results/playwright-html' }]]
    : [['list'], ['html', { open: 'on-failure', outputFolder: 'test-results/playwright-html' }]],

  use: {
    baseURL: BASE_URL,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // We trust localhost certs even when Next dev exposes self-signed
    // ones via a custom proxy. Harmless in dev.
    ignoreHTTPSErrors: true,
  },

  projects: [
    // -------------------------------------------------------------------
    // 1) Auth setup — runs once, produces storage-state JSONs that the
    //    rest of the suite consumes. No browser dependency, no auth.
    // -------------------------------------------------------------------
    {
      name: 'setup',
      testMatch: /e2e\/fixtures\/auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // -------------------------------------------------------------------
    // 2) Anonymous tests — login, register, role-redirect (the parts
    //    that test the unauthenticated entry points). No storageState.
    // -------------------------------------------------------------------
    {
      name: 'anonymous',
      testMatch: /e2e\/(auth\/(login|register|role-redirect)|.*public).*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // -------------------------------------------------------------------
    // 2b) Security tests — run without storageState; tests that need
    //     auth perform their own inline login.
    // -------------------------------------------------------------------
    {
      name: 'security',
      testMatch: /e2e\/security\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // -------------------------------------------------------------------
    // 3) Authenticated as ADMIN
    // -------------------------------------------------------------------
    {
      name: 'admin',
      dependencies: ['setup'],
      testMatch: /e2e\/.*\.admin\.spec\.ts|e2e\/(support|payments|developer)\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/admin.json',
      },
    },

    // -------------------------------------------------------------------
    // 4) Authenticated as CLIENT
    // -------------------------------------------------------------------
    {
      name: 'client',
      dependencies: ['setup'],
      testMatch: /e2e\/.*\.client\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/client.json',
      },
    },

    // -------------------------------------------------------------------
    // 5) Authenticated as SUPPORT (agent role) — used by ticket-flow
    //    tests when the implementation lands.
    // -------------------------------------------------------------------
    {
      name: 'support',
      dependencies: ['setup'],
      testMatch: /e2e\/.*\.support\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/support.json',
      },
    },
  ],

  webServer: AUTOSTART
    ? {
        command: 'pnpm dev:web',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 120_000,
      }
    : undefined,
});
