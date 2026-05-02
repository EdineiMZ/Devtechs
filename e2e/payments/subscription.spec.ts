import { expect, test } from '@playwright/test';

/**
 * Subscription lifecycle. Same caveat as checkout-pix: the
 * payments-service has the data model (Subscription, Payment), but
 * the management UI for the customer (cancel, change plan) and the
 * admin (refund, comp) needs to ship.
 */

test.describe('payments/subscription', () => {
  test.fixme('client sees own active subscription on /perfil/faturas', async ({ page }) => {
    // After a successful checkout in checkout-pix, the same client
    // visiting /perfil/faturas should see one row with status PAID
    // and the next billing date computed from plan.intervalDays.
    //
    //   await page.goto('/perfil/faturas');
    //   await expect(page.getByText(/próximo vencimento/i)).toBeVisible();
    expect(page).toBeDefined();
  });

  test.fixme('cancel subscription → status flips to CANCELED', async ({ page }) => {
    // 1. From /perfil/faturas, click "Cancelar assinatura".
    // 2. Confirm modal.
    // 3. Backend POST /subscriptions/:id/cancel. UI updates.
    // 4. Status badge swaps from ACTIVE to CANCELED. Access remains
    //    until subscription.expiresAt.
    expect(page).toBeDefined();
  });

  test.fixme('admin can refund a payment from /admin/financeiro', async ({ page }) => {
    // Admin context. From /admin/financeiro/faturas, click into a
    // PAID row, hit "Estornar". Backend issues an MP refund. Row
    // status becomes REFUNDED and an audit log row appears.
    expect(page).toBeDefined();
  });
});
