/**
 * AGRIVOR M2M read-only API client for the SZDevs admin.
 * Server-only — never import this in 'use client' components.
 *
 * Auth: HMAC-SHA256 signed requests (M2MGuard / SZD-689).
 *   X-SZDevs-Timestamp: <unix seconds>
 *   X-SZDevs-Signature: hex(HMAC-SHA256(SZDEVS_M2M_TOKEN, "METHOD\nPATH\nTIMESTAMP"))
 *
 * Env vars (must match AGRIVOR server):
 *   AGRIVOR_API_URL     — base URL, e.g. https://apiagrivor.szdevs.com
 *   SZDEVS_M2M_TOKEN    — shared secret (same value as in AGRIVOR .env)
 */

import { createHmac } from 'crypto';

// ── Response types (mirror M2MBillingService in AGRIVOR) ─────────────────────

export interface M2MBillingTenant {
  tenantId: string;
  name: string;
  consumedCents: number;
  softQuotaCents: number;
  hardQuotaCents: number;
  currentPeriod: string;
  hardBlock: boolean;
  lastActivity: string | null;
}

export interface M2MBillingListResult {
  tenants: M2MBillingTenant[];
  generatedAt: string;
}

/** Computed view used by the dashboard — percentUsed derived here. */
export interface TenantAiSpendingRow extends M2MBillingTenant {
  percentUsed: number;
}

// ── HMAC signing ──────────────────────────────────────────────────────────────

function signM2MRequest(
  method: string,
  path: string,
  secret: string,
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${method.toUpperCase()}\n${path}\n${timestamp}`;
  const signature = createHmac('sha256', secret).update(message).digest('hex');
  return {
    'X-SZDevs-Timestamp': String(timestamp),
    'X-SZDevs-Signature': signature,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAgrivorUrl(): string {
  return (process.env.AGRIVOR_API_URL ?? 'https://apiagrivor.szdevs.com').replace(/\/$/, '');
}

function getM2MToken(): string | undefined {
  return process.env.SZDEVS_M2M_TOKEN;
}

function computePercentUsed(consumed: number, hard: number): number {
  if (hard <= 0) return 0;
  return Math.round((consumed / hard) * 100);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * GET /m2m/billing/tenants — all tenants' AI billing summary.
 * Returns null on config error or network failure.
 */
export async function fetchAiBillingTenants(): Promise<TenantAiSpendingRow[] | null> {
  const secret = getM2MToken();
  if (!secret) {
    console.warn('[agrivor-api] SZDEVS_M2M_TOKEN not set — skipping M2M fetch');
    return null;
  }

  const path = '/m2m/billing/tenants';
  const url = `${getAgrivorUrl()}${path}`;
  const authHeaders = signM2MRequest('GET', path, secret);

  try {
    const res = await fetch(url, {
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error(`[agrivor-api] GET ${path} → ${res.status}`);
      return null;
    }

    const data = (await res.json()) as M2MBillingListResult;
    return data.tenants.map((t) => ({
      ...t,
      percentUsed: computePercentUsed(t.consumedCents, t.hardQuotaCents),
    }));
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
