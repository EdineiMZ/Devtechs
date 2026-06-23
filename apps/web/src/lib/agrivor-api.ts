import { auth } from '@/auth';

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

export interface AgrivorPricePlan {
  slug: string;
  name: string;
  priceReais: number;
  aiQuotaCents: number;
}

export interface AgrivorPriceAuditEntry {
  id: string;
  changedAt: string;
  changedBy: string | null;
  field: string;
  oldValue: number | null;
  newValue: number;
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

async function request<T>(
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
  return request<AgrivorKey[]>('/keys', {
    query: filters as Record<string, string | undefined>,
    accessToken,
  });
}

export async function issueAgrivorKey(
  input: { customerId: string; modules: string[]; expiresInDays?: number },
  accessToken?: string,
): Promise<ApiResult<AgrivorKey>> {
  return request<AgrivorKey>('/keys/issue', {
    method: 'POST',
    body: input,
    accessToken,
  });
}

export async function revokeAgrivorKey(
  id: string,
  accessToken?: string,
): Promise<ApiResult<AgrivorKey>> {
  return request<AgrivorKey>(`/keys/${encodeURIComponent(id)}/revoke`, {
    method: 'DELETE',
    accessToken,
  });
}

export async function renewAgrivorKey(
  id: string,
  input: { expiresInDays: number },
  accessToken?: string,
): Promise<ApiResult<AgrivorKey>> {
  return request<AgrivorKey>(`/keys/${encodeURIComponent(id)}/renew`, {
    method: 'POST',
    body: input,
    accessToken,
  });
}

export async function listAgrivorPayments(
  accessToken?: string,
): Promise<ApiResult<AgrivorPayment[]>> {
  return request<AgrivorPayment[]>('/payments', { accessToken });
}

export async function listAgrivorTelemetry(
  accessToken?: string,
): Promise<ApiResult<AgrivorTelemetry[]>> {
  return request<AgrivorTelemetry[]>('/telemetry', { accessToken });
}
