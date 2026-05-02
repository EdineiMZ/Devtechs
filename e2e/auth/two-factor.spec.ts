import { expect, test } from '@playwright/test';

/**
 * 2FA flow tests. The auth-service backend is fully implemented:
 *   POST /auth/2fa/setup      → returns QR + secret
 *   POST /auth/2fa/enable     → activates after TOTP verify
 *   POST /auth/2fa/verify     → second-factor login
 *
 * The UI lives on /perfil/configuracoes/2fa, which is in the
 * pending-implementation list (P1, see docs/pending-implementation.html).
 * Each test below documents the exact assertion shape so wiring is
 * a 30-minute job once the page ships.
 *
 * Test users: requires a seeded user with twoFactorEnabled=true and
 * twoFactorSecret known to the test runner via E2E_2FA_SECRET. Use
 * `authenticator.generate(secret)` from `otplib` (already a dep of
 * auth-service) to mint the live code.
 */

test.describe('auth/two-factor', () => {
  test.fixme('setup flow: scan QR → enter code → 2FA enabled', async ({ page }) => {
    // Login as a user without 2FA, navigate to /perfil/configuracoes/2fa,
    // click "Ativar 2FA", expect QR + secret displayed, type a fresh
    // TOTP code from `authenticator.generate(secret)`, click confirm.
    // Expect banner "2FA ativado" + a list of recovery codes.
    expect(page).toBeDefined();
  });

  test.fixme('login two-step: email+password → TOTP prompt → access', async ({ page }) => {
    // 1. await page.goto('/login')
    // 2. fill email + password of a user with 2FA on
    // 3. submit; form should reveal the "Código de verificação" input
    //    (phase changes to 'two-factor')
    // 4. compute totp = authenticator.generate(process.env.E2E_2FA_SECRET!)
    // 5. fill code, submit, expect redirect to home.
    expect(page).toBeDefined();
  });

  test.fixme('login two-step: wrong TOTP → INVALID_CREDENTIALS banner', async ({ page }) => {
    // Submit a six-digit but incorrect code; expect the banner
    // mapped from AUTH_ERRORS.INVALID_CREDENTIALS.
    expect(page).toBeDefined();
  });

  test.fixme('disable 2FA: requires current password + TOTP', async ({ page }) => {
    // From /perfil/configuracoes/2fa with 2FA on, click "Desativar",
    // submit password + valid TOTP, expect 2FA off afterwards.
    expect(page).toBeDefined();
  });
});
