import { expect, test } from '@playwright/test';

/**
 * Pix checkout flow. The store app on :3006 already has /planos and
 * /checkout shells; the Pix modality and the Mercado Pago webhook
 * handler are the bits that need wiring before this spec turns green.
 *
 * Setup:
 *   - process.env.E2E_PAYMENTS_PLAN_ID — id of a test plan that's
 *     priced low enough to keep the MP test account happy.
 *   - The MP webhook signature uses the same secret as production —
 *     for E2E, point payments-service at MP_WEBHOOK_SECRET=test_secret
 *     and use that to sign the mocked POST below.
 */

test.describe('payments/checkout-pix', () => {
  test.fixme('select plan → checkout → Pix → QR code visible', async ({ page }) => {
    // 1. Visit /planos and click "Assinar" on a known test plan.
    // 2. /checkout?plan=<id> renders. Pick "Pix" payment method.
    // 3. Submit. The page should render a QR code <img> and a
    //    copy-paste code (QR base64 from MP).
    //
    // Assertion shape:
    //   await expect(page.getByRole('img', { name: /qr code pix/i })).toBeVisible();
    //   await expect(page.getByRole('button', { name: /copiar código/i })).toBeVisible();
    //
    // Skip until checkout/pix UI lands.
    expect(page).toBeDefined();
  });

  test.fixme('webhook flips status to PAID without page reload', async ({ page, request }) => {
    // After the QR code is on screen, hit the payments-service
    // webhook endpoint with a signed payload that mirrors what MP
    // sends. The page polls /api/payments/<id>/status (or subscribes
    // via SSE) and flips its UI to "Pagamento confirmado" within ~5s.
    //
    //   const sig = signMpWebhook(payload, process.env.MP_WEBHOOK_SECRET!);
    //   await request.post('/payments/webhooks/mp', {
    //     headers: { 'x-signature': sig, 'content-type': 'application/json' },
    //     data: payload,
    //   });
    //   await expect(page.getByText(/pagamento confirmado/i)).toBeVisible({ timeout: 10000 });
    expect(page).toBeDefined();
    void request;
  });

  test.fixme('expired QR shows refresh button', async ({ page }) => {
    // Pix QR codes from MP carry an expires_in. The UI should
    // gracefully handle expiry: replace the QR with a banner
    // "QR expirou — Gerar novo" + a button that posts to
    // /api/payments/<id>/refresh and re-renders.
    expect(page).toBeDefined();
  });
});
