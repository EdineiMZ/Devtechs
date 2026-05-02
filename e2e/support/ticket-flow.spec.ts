import { expect, test } from '@playwright/test';

/**
 * Ticket lifecycle E2E. The support-service backend is implemented
 * (REST + Socket.IO gateway, both verified in the audit session),
 * but the consuming UI lives in the pending-implementation list
 * (P0, see docs/pending-implementation.html — "Módulo de Chamados").
 *
 * Project mapping (playwright.config.ts):
 *   - This spec runs as `*.client.spec.ts` for the requester half and
 *     `*.support.spec.ts` for the agent half. To exercise both ends
 *     concurrently we spin up two contexts inside one test (see the
 *     "real-time" test below).
 */

const TICKET_TITLE = `e2e ticket ${Date.now()}`;
const FIRST_REPLY = 'Olá, recebemos seu chamado.';

test.describe('support/ticket-flow', () => {
  test.fixme('client opens ticket → ticket appears in agent queue', async ({ browser }) => {
    // Two contexts: client + agent. The client context starts from
    // .auth/client.json, the agent from .auth/support.json.
    const clientCtx = await browser.newContext({ storageState: '.auth/client.json' });
    const agentCtx = await browser.newContext({ storageState: '.auth/support.json' });
    const clientPage = await clientCtx.newPage();
    const agentPage = await agentCtx.newPage();

    await clientPage.goto('/perfil/tickets/novo');
    await clientPage.locator('input[name="titulo"]').fill(TICKET_TITLE);
    await clientPage.locator('textarea[name="descricao"]').fill('Detalhes do problema.');
    await clientPage.locator('button[type="submit"]').click();
    await clientPage.waitForURL(/\/perfil\/tickets\/[a-z0-9]+/);

    await agentPage.goto('/admin/suporte');
    await expect(agentPage.getByText(TICKET_TITLE)).toBeVisible({ timeout: 5000 });

    await clientCtx.close();
    await agentCtx.close();
  });

  test.fixme(
    'agent replies → client sees message in real-time (Socket.IO)',
    async ({ browser }) => {
      // After the previous step, both pages are on the ticket detail.
      // Agent submits a message; the client's `useTicketChat` hook
      // receives `message:new` and renders a new bubble within ~1s.
      //
      // Assertion shape:
      //   await agentPage.locator('textarea[name="message"]').fill(FIRST_REPLY);
      //   await agentPage.locator('button[type="submit"]').click();
      //   await expect(clientPage.getByText(FIRST_REPLY)).toBeVisible({ timeout: 3000 });
      expect(browser).toBeDefined();
      void FIRST_REPLY;
    },
  );

  test.fixme(
    'agent closes ticket → client receives CSAT prompt',
    async ({ browser }) => {
      // Agent clicks "Marcar como resolvido". Backend sets status =
      // RESOLVED and emits ticket:status. Client renders a CSAT card
      // (1–5 stars) inside the chat thread.
      //
      // Assertion: await expect(clientPage.getByRole('group', { name: /avalia/i })).toBeVisible();
      expect(browser).toBeDefined();
    },
  );
});
