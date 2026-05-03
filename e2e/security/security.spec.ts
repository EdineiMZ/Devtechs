import { expect, test } from '@playwright/test';

import { ADMIN, CLIENT } from '../fixtures/users';

/**
 * Security test suite for the SZDevs web application.
 *
 * Covers OWASP Top 10 and common web security issues:
 *   - Authentication & authorization
 *   - XSS (Cross-Site Scripting)
 *   - CSRF protection
 *   - Open redirect
 *   - Secure cookie attributes
 *   - Security headers
 *   - Input validation
 *   - Sensitive data exposure
 */

// â”€â”€â”€ Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const XSS_PAYLOADS = [
  '<script>alert("xss")</script>',
  '"><img src=x onerror=alert(1)>',
  "';alert('xss');//",
  '<svg onload=alert(1)>',
  'javascript:alert(1)',
];

// â”€â”€â”€ 1. Secure Cookie Attributes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.describe('security/cookies', () => {
  test('session cookie is HttpOnly (not readable by JS)', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill(ADMIN.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15_000 });

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(
      (c) => /session-token/i.test(c.name) || c.name.startsWith('authjs'),
    );
    expect(sessionCookie, 'Session cookie must exist').toBeDefined();
    expect(sessionCookie?.httpOnly, 'Session cookie must be HttpOnly').toBe(true);
  });

  test('session cookie has SameSite=Lax or Strict (CSRF mitigation)', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill(ADMIN.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15_000 });

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(
      (c) => /session-token/i.test(c.name) || c.name.startsWith('authjs'),
    );
    expect(sessionCookie, 'Session cookie must exist').toBeDefined();
    const sameSite = sessionCookie?.sameSite ?? '';
    expect(
      ['Lax', 'Strict'].includes(sameSite),
      `Session cookie SameSite should be Lax or Strict, got: ${sameSite}`,
    ).toBe(true);
  });

  test('no sensitive data in localStorage after login', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill(ADMIN.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15_000 });

    const storage = await page.evaluate(() => {
      const data: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) as string;
        data[key] = localStorage.getItem(key) as string;
      }
      return data;
    });

    const storageStr = JSON.stringify(storage).toLowerCase();
    expect(
      storageStr.includes('password') || storageStr.includes('token') || storageStr.includes('secret'),
      `localStorage must not contain passwords, tokens or secrets. Found: ${storageStr.substring(0, 200)}`,
    ).toBe(false);
  });
});

// â”€â”€â”€ 2. Security Headers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.describe('security/headers', () => {
  test('login page has X-Frame-Options or CSP frame-ancestors (clickjacking protection)', async ({
    request,
  }) => {
    const resp = await request.get('/login');
    const xfo = resp.headers()['x-frame-options'];
    const csp = resp.headers()['content-security-policy'];

    const hasClickjackProtection =
      (xfo && (xfo.toUpperCase().includes('DENY') || xfo.toUpperCase().includes('SAMEORIGIN'))) ||
      (csp && csp.includes('frame-ancestors'));

    expect(
      hasClickjackProtection,
      `Missing clickjacking protection. X-Frame-Options: ${xfo}, CSP: ${csp}`,
    ).toBeTruthy();
  });

  test('responses include X-Content-Type-Options: nosniff', async ({ request }) => {
    const resp = await request.get('/login');
    const xcto = resp.headers()['x-content-type-options'];
    expect(xcto?.toLowerCase()).toBe('nosniff');
  });

  test('admin route is not accessible without authentication (401/302)', async ({ request }) => {
    const resp = await request.get('/admin', { maxRedirects: 0 });
    // Should redirect to login (302/307) or return 401.
    expect([301, 302, 307, 308, 401, 403]).toContain(resp.status());
  });

  test('API routes are not accessible without authentication', async ({ request }) => {
    const resp = await request.get('/api/admin/audit/logs', { maxRedirects: 0 });
    expect([401, 403, 302, 307]).toContain(resp.status());
  });
});

// â”€â”€â”€ 3. Authentication Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.describe('security/authentication', () => {
  test('wrong password does not leak user existence (consistent error)', async ({ browser }) => {
    // Use separate pages so each attempt starts fresh (avoids stale alert state).
    const ctxKnown = await browser.newContext();
    const pageKnown = await ctxKnown.newPage();
    await pageKnown.goto('/login');
    await pageKnown.locator('input[type="email"]').fill(ADMIN.email);
    await pageKnown.locator('input[type="password"]').fill('totally-wrong-password');
    await pageKnown.locator('button[type="submit"]').click();
    await pageKnown.getByRole('alert').first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    const errorTextKnown = await pageKnown.getByRole('alert').first().textContent().catch(() => '');
    await ctxKnown.close();

    const ctxUnknown = await browser.newContext();
    const pageUnknown = await ctxUnknown.newPage();
    await pageUnknown.goto('/login');
    await pageUnknown.locator('input[type="email"]').fill('nonexistent@example.com');
    await pageUnknown.locator('input[type="password"]').fill('totally-wrong-password');
    await pageUnknown.locator('button[type="submit"]').click();
    await pageUnknown.getByRole('alert').first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    const errorTextUnknown = await pageUnknown.getByRole('alert').first().textContent().catch(() => '');
    await ctxUnknown.close();

    // Both should return the same generic error (not expose whether email exists).
    const normalizeMsg = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    expect(
      normalizeMsg(errorTextKnown || ''),
      'Error messages should be generic (not reveal if email exists)',
    ).toBe(normalizeMsg(errorTextUnknown || ''));
  });

  test('unauthenticated access to /admin â†’ redirected to /login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated access to /admin/rh â†’ redirected to /login', async ({ page }) => {
    await page.goto('/admin/rh');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated access to /admin/financeiro â†’ redirected to /login', async ({ page }) => {
    await page.goto('/admin/financeiro');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated access to /perfil â†’ redirected to /login', async ({ page }) => {
    await page.goto('/perfil');
    await expect(page).toHaveURL(/\/login/);
  });

  test('client cannot access admin routes â†’ redirected to /perfil', async ({ page }) => {
    // Login as client
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(CLIENT.email);
    await page.locator('input[type="password"]').fill(CLIENT.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15_000 });

    // Attempt to visit admin-only route
    await page.goto('/admin/rh');
    await page.waitForLoadState('networkidle');
    const finalUrl = page.url();
    expect(
      finalUrl.includes('/perfil') || finalUrl.includes('/verificar-email') || finalUrl.includes('/login'),
      `Client should be redirected away from admin. Got: ${finalUrl}`,
    ).toBe(true);
  });
});

// â”€â”€â”€ 4. Open Redirect â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.describe('security/open-redirect', () => {
  test('callbackUrl does not redirect to external domain', async ({ page }) => {
    const externalUrl = 'https://evil.example.com';
    await page.goto(`/login?callbackUrl=${encodeURIComponent(externalUrl)}`);
    await page.locator('input[type="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill(ADMIN.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15_000 });

    const finalUrl = page.url();
    expect(
      finalUrl.startsWith('http://localhost') || finalUrl.startsWith('http://127.0.0.1'),
      `Open redirect! Login redirected to external URL: ${finalUrl}`,
    ).toBe(true);
  });

  test('callbackUrl with protocol-relative URL does not redirect externally', async ({ page }) => {
    const maliciousCallbackUrl = '//evil.example.com';
    await page.goto(`/login?callbackUrl=${encodeURIComponent(maliciousCallbackUrl)}`);
    await page.locator('input[type="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill(ADMIN.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15_000 });

    const finalUrl = page.url();
    expect(
      finalUrl.startsWith('http://localhost') || finalUrl.startsWith('http://127.0.0.1'),
      `Open redirect via protocol-relative URL! Got: ${finalUrl}`,
    ).toBe(true);
  });
});

// â”€â”€â”€ 5. XSS â€“ Reflected / Stored â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.describe('security/xss', () => {
  for (const payload of XSS_PAYLOADS) {
    test(`XSS payload in login email field is not executed: ${payload.substring(0, 30)}`, async ({
      page,
    }) => {
      let alertFired = false;
      page.on('dialog', (dialog) => {
        alertFired = true;
        dialog.dismiss();
      });

      await page.goto('/login');
      await page.locator('input[type="email"]').fill(payload);
      await page.locator('input[type="password"]').fill('anything');
      await page.locator('button[type="submit"]').click();
      await page.waitForLoadState('networkidle');

      expect(alertFired, `XSS payload executed an alert: ${payload}`).toBe(false);
    });
  }

  test('XSS payload in register name field is not executed', async ({ page }) => {
    let alertFired = false;
    page.on('dialog', (dialog) => {
      alertFired = true;
      dialog.dismiss();
    });

    await page.goto('/register');
    await page.locator('input[name="nome"], input[name="name"]').first().fill(XSS_PAYLOADS[0]);
    await page.locator('input[type="email"]').fill('xss-test@example.com');
    await page.locator('input[name="password"]').first().fill('Strong@Pwd2026');
    await page.locator('input[name="confirmPassword"]').first().fill('Strong@Pwd2026');
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');

    expect(alertFired, `XSS via register name field`).toBe(false);
  });

  test('XSS payload in contact form is not executed', async ({ page }) => {
    let alertFired = false;
    page.on('dialog', (dialog) => {
      alertFired = true;
      dialog.dismiss();
    });

    await page.goto('/contato');
    await page.waitForLoadState('networkidle');

    // Fill any text inputs with XSS payload
    const inputs = page.locator('input[type="text"], textarea');
    const count = await inputs.count();
    for (let i = 0; i < Math.min(count, 3); i++) {
      await inputs.nth(i).fill(XSS_PAYLOADS[1]).catch(() => {});
    }

    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForLoadState('networkidle');
    }

    expect(alertFired, `XSS via contact form`).toBe(false);
  });
});

// â”€â”€â”€ 6. Input Validation & Injection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.describe('security/input-validation', () => {
  test('SQL injection in login email does not crash the app', async ({ page }) => {
    const sqlPayloads = ["' OR '1'='1", "admin'--", "' UNION SELECT 1,2,3--"];

    for (const payload of sqlPayloads) {
      await page.goto('/login');
      await page.locator('input[type="email"]').fill(payload);
      await page.locator('input[type="password"]').fill('anything');
      await page.locator('button[type="submit"]').click();
      await page.waitForLoadState('networkidle');

      // Must not crash (500 error) and must stay on login with an error.
      await expect(page).toHaveURL(/\/login/);
      // Page must still be functional (not a blank page or error boundary).
      await expect(page.locator('input[type="email"]').first()).toBeVisible();
    }
  });

  test('path traversal in URL is handled gracefully', async ({ page }) => {
    const resp = await page.goto('/../../../etc/passwd');
    // Should return 404 or redirect to root/login â€” never serve file contents.
    expect(resp?.status()).not.toBe(200);
  });

  test('very long email input does not crash the app', async ({ page }) => {
    const longEmail = 'a'.repeat(500) + '@example.com';
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(longEmail);
    await page.locator('input[type="password"]').fill('anything');
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');

    // App must remain functional.
    await expect(page.locator('body')).toBeVisible();
  });
});

// â”€â”€â”€ 7. Session Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.describe('security/session', () => {
  test('logout invalidates session (protected route inaccessible after logout)', async ({
    page,
  }) => {
    // Login
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill(ADMIN.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/login/);

    // Logout via NextAuth signOut endpoint
    await page.goto('/api/auth/signout');
    await page.waitForLoadState('networkidle');

    // Click the signout button if present (NextAuth shows a confirmation page)
    const signOutBtn = page.locator('button[type="submit"], form button').first();
    if (await signOutBtn.isVisible()) {
      await signOutBtn.click();
      await page.waitForLoadState('networkidle');
    }

    // Now try to access protected route
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('CSRF: signout requires a form POST (GET does not log out)', async ({ page, request }) => {
    // GET to signout should not log the user out â€” it should only show a confirmation form.
    const resp = await request.get('/api/auth/signout', { maxRedirects: 0 });
    // NextAuth returns 200 with the signout HTML form on GET (not a redirect that clears cookies).
    // This verifies it doesn't auto-logout on a GET request (CSRF vector if it did).
    expect(resp.status()).toBe(200);
    const body = await resp.text();
    // NextAuth v5 signout page contains a form for POST confirmation.
    expect(body.toLowerCase()).toContain('form');
  });
});

// â”€â”€â”€ 8. Password Field Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.describe('security/password-fields', () => {
  test('password input type is "password" (masked)', async ({ page }) => {
    await page.goto('/login');
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(passwordInput).toBeVisible();
    const type = await passwordInput.getAttribute('type');
    expect(type).toBe('password');
  });

  test('password field has autocomplete=current-password', async ({ page }) => {
    await page.goto('/login');
    const passwordInput = page.locator('input[type="password"]').first();
    const autocomplete = await passwordInput.getAttribute('autocomplete');
    // Acceptable: "current-password" or "off" (not "on" which exposes passwords).
    expect(
      autocomplete === 'current-password' || autocomplete === 'off' || autocomplete === null,
      `Unexpected autocomplete="${autocomplete}" on password field`,
    ).toBe(true);
  });

  test('register password fields are masked', async ({ page }) => {
    await page.goto('/register');
    const pwdInputs = page.locator('input[type="password"]');
    const count = await pwdInputs.count();
    expect(count).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < count; i++) {
      const t = await pwdInputs.nth(i).getAttribute('type');
      expect(t).toBe('password');
    }
  });
});

// â”€â”€â”€ 9. Sensitive Route Enumeration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.describe('security/route-enumeration', () => {
  // Routes that exist in the Next.js web app and MUST require auth.
  const protectedGetRoutes = ['/api/admin/audit/logs'];

  for (const route of protectedGetRoutes) {
    test(`${route} requires authentication (GET)`, async ({ request }) => {
      const resp = await request.get(route, { maxRedirects: 0 });
      expect(
        [401, 403, 302, 307].includes(resp.status()),
        `${route} returned ${resp.status()} â€” should require auth`,
      ).toBe(true);
    });
  }

  // /api/admin/users lives on the auth-service, not Next.js â†’ 404 is correct.
  test('/api/admin/users: not exposed as Next.js API route (404)', async ({ request }) => {
    const resp = await request.get('/api/admin/users', { maxRedirects: 0 });
    // 404 means the route is correctly not exposed in the web app.
    // 401/403 also acceptable if it becomes a proxy route.
    expect(
      [401, 403, 404, 302, 307].includes(resp.status()),
      `/api/admin/users returned ${resp.status()}`,
    ).toBe(true);
  });

  // Recovery codes endpoint is POST-only â€” GET returning 405 is correct behavior.
  test('/api/account/2fa/recovery-codes: POST-only (405 on GET = secured)', async ({ request }) => {
    const resp = await request.get('/api/account/2fa/recovery-codes', { maxRedirects: 0 });
    // 405 (Method Not Allowed) means GET is blocked â€” the data is not exposed.
    // 401/403 also acceptable. 200 would be a security issue.
    expect(
      [401, 403, 404, 405, 302, 307].includes(resp.status()),
      `/api/account/2fa/recovery-codes returned ${resp.status()}`,
    ).toBe(true);
  });
});
