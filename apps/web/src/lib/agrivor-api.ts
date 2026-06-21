/**
 * AGRIVOR API clients for the SZDevs admin. Server-only.
 *
 * ── Section A: M2M Billing (gastos-ia dashboard, SZD-691) ────────────────────
 * Auth: HMAC-SHA256 signed requests (M2MGuard / SZD-689).
 *   X-SZDevs-Timestamp: <unix seconds>
 *   X-SZDevs-Signature: hex(HMAC-SHA256(SZDEVS_M2M_TOKEN, "METHOD\nPATH\nTIMESTAMP"))
 * Env vars: AGRIVOR_API_URL, SZDEVS_M2M_TOKEN (must match AGRIVOR server)
 *
 * ── Section B: Admin Key/Payment/Telemetry (sidebar, SZD-690) ────────────────
 * Auth: session JWT forwarded as Bearer token.
 * Env var: AGRIVOR_SERVICE_URL (internal AGRIVOR service base URL)
 */

import { createHmac } from 'crypto';
import { auth } from '@/auth';

// ════════════════════════════════════════════════════════════════════════════
// SECTION A — M2M Billing (HMAC-SHA256)
// ════════════════════════════════════════════════════════════════════════════

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

export interface TenantAiSpendingRow extends M2MBillingTenant {
  percentUsed: number;
}

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

function getAgrivorM2MUrl(): string {
  return (process.env.AGRIVOR_API_URL ?? 'https://apiagrivor.szdevs.com').replace(/\/$/, '');
}

function getM2MToken(): string | undefined {
  return process.env.SZDEVS_M2M_TOKEN;
}

function computePercentUsed(consumed: number, hard: number): number {
  if (hard <= 0) return 0;
  return Math.round((consumed / hard) * 100);
}

export async function fetchAiBillingTenants(): Promise<TenantAiSpendingRow[] | null> {
  const secret = getM2MToken();
  if (!secret) {
    console.warn('[agrivor-api] SZDEVS_M2M_TOKEN not set — skipping M2M fetch');
    return null;
  }

  const path = '/m2m/billing/tenants';
  const url = `${getAgrivorM2MUrl()}${path}`;
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

export function currentPeriod(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION B — Admin Key / Payment / Telemetry (session JWT)
// ════════════════════════════════════════════════════════════════════════════

export function getAgrivorServiceUrl(): string {
  return (
    process.env.AGRIVOR_SERVICE_URL ??
    process.env.NEXT_PUBLIC_AGRIVOR_URL ??
    'http://127.0.0.1:3000'
  );
}

export type AgrivorKeyStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'PENDING';

export interface AgrivorKey {
  id: string;
  customerId: string;
  status: AgrivorKeyStatus;
  modules: string[];
  expiresAt: string | null;
  lastHeartbeatAt: string | null;
  lastValidatedAt: string | null;
  createdAt: string;
}

export interface AgrivorPayment {
  id: string;
  customerId: string | null;
  tenantId: string | null;
  amount: number;
  status: string;
  method: string;
  mpPaymentId: string | null;
  metadata: Record<string, unknown>;
  paidAt: string;
}

export interface AgrivorTenantKey {
  tenantId: string;
  name: string;
  key: string;
  status: AgrivorKeyStatus;
  expiresAt: string | null;
  lastHeartbeatAt: string | null;
  modules: string[];
}

export interface AgrivorTelemetry {
  customerId: string;
  isOnline: boolean;
  lastHeartbeat: string | null;
  lastValidation: string | null;
  gracePeriodEndsAt: string | null;
  activeModules: string[];
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | { message?: string };
}

async function resolveToken(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  const session = await auth();
  if (!session?.accessToken) throw new Error('agrivor-api: no active session');
  return session.accessToken;
}

async function adminRequest<T>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | undefined>;
    accessToken?: string;
  } = {},
): Promise<ApiResult<T>> {
  const token = await resolveToken(init.accessToken);

  const params = init.query
    ? '?' +
      Object.entries(init.query)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';

  const url = `${getAgrivorServiceUrl()}/api/admin/agrivor${path}${params}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: 503, data: { message: 'agrivor-service indisponível' } };
  }

  let data: T | { message?: string };
  try {
    data = (await res.json()) as T;
  } catch {
    data = { message: 'Resposta inválida do agrivor-service' };
  }
  return { ok: res.ok, status: res.status, data };
}

export async function listAgrivorKeys(
  filters: { status?: AgrivorKeyStatus } = {},
  accessToken?: string,
): Promise<ApiResult<AgrivorKey[]>> {
  return adminRequest<AgrivorKey[]>('/keys', {
    query: filters as Record<string, string | undefined>,
    accessToken,
  });
}

export async function issueAgrivorKey(
  input: { customerId: string; modules: string[]; expiresInDays?: number },
  accessToken?: string,
): Promise<ApiResult<AgrivorKey>> {
  return adminRequest<AgrivorKey>('/keys/issue', {
    method: 'POST',
    body: input,
    accessToken,
  });
}

export async function revokeAgrivorKey(
  id: string,
  accessToken?: string,
): Promise<ApiResult<AgrivorKey>> {
  return adminRequest<AgrivorKey>(`/keys/${encodeURIComponent(id)}/revoke`, {
    method: 'DELETE',
    accessToken,
  });
}

export async function renewAgrivorKey(
  id: string,
  input: { expiresInDays: number },
  accessToken?: string,
): Promise<ApiResult<AgrivorKey>> {
  return adminRequest<AgrivorKey>(`/keys/${encodeURIComponent(id)}/renew`, {
    method: 'POST',
    body: input,
    accessToken,
  });
}

export async function listAgrivorPayments(
  accessToken?: string,
): Promise<ApiResult<AgrivorPayment[]>> {
  return adminRequest<AgrivorPayment[]>('/payments', { accessToken });
}

export async function listAgrivorTelemetry(
  accessToken?: string,
): Promise<ApiResult<AgrivorTelemetry[]>> {
  return adminRequest<AgrivorTelemetry[]>('/telemetry', { accessToken });
}
