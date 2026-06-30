/**
 * Server-side helpers for talking to the `szdevs-api` service.
 *
 * `szdevs-api` runs outside the Docker SZDevs stack (PM2 on the host).
 * From inside Docker containers it is reachable via the bridge gateway.
 *
 * URL resolution order:
 *   1. SZDEVS_API_URL — set in production .env (e.g. http://172.16.1.1:5100)
 *   2. http://localhost:5100 — dev fallback
 */

function getSzdevsApiUrl(): string {
  return process.env.SZDEVS_API_URL ?? 'http://localhost:5100';
}

export interface AiBalance {
  tenantId: string;
  plan: string;
  status: string;
  aiBalance: {
    used: number;
    limit: number;
    remaining: number;
    periodStart: string;
  };
}

/**
 * Fetches the AI usage balance for a given tenant.
 * Returns null when the tenant has no subscription or the service is unreachable.
 */
export async function fetchAiBalance(tenantId: string): Promise<AiBalance | null> {
  try {
    const res = await fetch(
      `${getSzdevsApiUrl()}/api/subscriptions/${encodeURIComponent(tenantId)}/ai-balance`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    return (await res.json()) as AiBalance;
  } catch {
    return null;
  }
}
