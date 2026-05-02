import { expect, test } from '@playwright/test';

/**
 * Real-time chat semantics for the support module. Backend gateway
 * is live at support-service:4008 namespace `/support` (verified via
 * scripts/e2e-tests/06-socket.mjs in the prior audit). UI consumer
 * is pending — this file holds the contract tests for when it lands.
 */

test.describe('support/chat', () => {
  test.fixme('typing indicator appears for the other side', async ({ browser }) => {
    // Client + agent on the same ticket. Client starts typing in the
    // composer; agent sees a "Cliente está digitando..." pill within
    // ~600ms. After client stops typing, the pill disappears within
    // ~3s (debounced by the gateway).
    expect(browser).toBeDefined();
  });

  test.fixme('reconnects after network blip', async ({ browser }) => {
    // 1. Client connected to a ticket.
    // 2. Disable network in the client context for ~3s.
    // 3. Re-enable; expect the chat header to swap from
    //    "Reconectando…" back to a healthy state, AND any messages
    //    sent by the agent during the blip to flush in.
    expect(browser).toBeDefined();
  });

  test.fixme('internal note: visible to agent, not to client', async ({ browser }) => {
    // Agent sends with isInternal=true. Agent sees the bubble flagged
    // "Nota interna". The same payload, broadcast through the gateway,
    // must NOT appear on the client side — the gateway already filters
    // by `isAgent`, so this is a regression guard.
    expect(browser).toBeDefined();
  });
});
