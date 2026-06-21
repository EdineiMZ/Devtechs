/**
 * AGRIVOR M2M read-only API client for the SZDevs admin.
 *
 * Auth: service token (X-Agrivor-Service-Token header), NOT a user JWT.
 * This client is server-only — never import it in 'use client' components.
 *
 * WS1 (SZD-689) will finalize the endpoint URL and auth contract.
 * Until then, AGRIVOR_API_URL defaults to the known prod base URL and
 * AGRIVOR_SERVICE_TOKEN must be set in the VPS environment.
 */

export interface TenantAiSpendingRow {
  tenantId: string;
  tenantName: string;
  period: string;
  consumedCents: number;
  softQuotaCents: number;
  hardQuotaCents: number;
  percentUsed: number;
  hardBlock: boolean;
  apiCallCount: number;
}

export interface AiSpendingReport {
  period: string;
  generatedAt: string;
  tenants: TenantAiSpendingRow[];
}

function getAgrivorUrl(): string {
  return process.env.AGRIVOR_API_URL ?? 'https://apiagrivor.szdevs.com';
}

function getServiceToken(): string | undefined {
  return process.env.AGRIVOR_SERVICE_TOKEN;
}

/**
 * Fetch AI spending report from AGRIVOR for a given period (YYYY-MM).
 * Returns null when the service is unreachable or the token is missing.
 *
 * TODO (WS1 / SZD-689): confirm exact endpoint path and auth header name
 * after the architecture gate (WS0 / SZD-687) closes.
 */
export async function fetchAiSpendingReport(
  period: string,
): Promise<AiSpendingReport | null> {
  const token = getServiceToken();
  if (!token) {
    console.warn('[agrivor-api] AGRIVOR_SERVICE_TOKEN not set — skipping fetch');
    return null;
  }

  const url = `${getAgrivorUrl()}/admin/report/ai-usage?period=${encodeURIComponent(period)}`;

  try {
    const res = await fetch(url, {
      headers: {
        'X-Agrivor-Service-Token': token,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error(`[agrivor-api] ${url} → ${res.status}`);
      return null;
    }

    return (await res.json()) as AiSpendingReport;
  } catch (err) {
    console.error('[agrivor-api] fetch error', err);
    return null;
  }
}

/** Current billing period in YYYY-MM format (UTC). */
export function currentPeriod(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
