/**
 * api-keys-api.ts — typed REST wrapper for the api-service internal API keys endpoints.
 *
 * Server-only by default. Pass an explicit accessToken for calls from
 * Server Actions (dialogs that never run on the client).
 */

export function getApiServiceUrl(): string {
  return process.env.API_SERVICE_URL ?? 'http://api-service:3011';
}

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | { message?: string | string[]; error?: string };
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type ApiKeyStatus = 'ACTIVE' | 'REVOKED' | 'SUSPENDED' | 'EXPIRED';
export type IpBindingMode = 'AUTO' | 'MANUAL' | 'DISABLED';

export interface RateLimit {
  perMinute: number;
  perHour: number;
  perDay: number;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  ipBinding: IpBindingMode;
  boundIps: string[];
  rateLimit: RateLimit;
  status: ApiKeyStatus;
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  totalRequests: number;
  revokeReason: string | null;
  createdAt: string;
}

export interface ApiKeyAuditLog {
  id: string;
  apiKeyId: string;
  event: string;
  ip: string | null;
  endpoint: string | null;
  statusCode: number | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface Metrics {
  totalRequests: number;
  requestsToday: number;
  lastUsedIp: string | null;
  requestsByHour: Array<{ hour: number; count: number }>;
}

export interface CreateApiKeyResult {
  key: string;
  apiKey: ApiKey;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateApiKeyInput {
  name: string;
  permissions: string[];
  ipBinding: IpBindingMode;
  boundIps?: string[];
  rateLimit: RateLimit;
  expiresAt?: string;
}

export interface UpdateApiKeyInput extends Partial<CreateApiKeyInput> {}

export interface ListAuditLogsOptions {
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

async function request<T>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | undefined>;
    accessToken: string;
  },
): Promise<ApiResult<T>> {
  const params =
    init.query
      ? '?' +
        Object.entries(init.query)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';

  const url = `${getApiServiceUrl()}${path}${params}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${init.accessToken}`,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: 503, data: { message: 'api-service indisponível' } };
  }

  let data: T | { message?: string };
  try {
    data = (await res.json()) as T;
  } catch {
    data = { message: 'Resposta inválida do api-service' };
  }
  return { ok: res.ok, status: res.status, data };
}

// ---------------------------------------------------------------------------
// Exported API functions
// ---------------------------------------------------------------------------

export async function listApiKeys(accessToken: string): Promise<ApiResult<ApiKey[]>> {
  return request<ApiKey[]>('/internal/api-keys', { accessToken });
}

export async function getApiKey(id: string, accessToken: string): Promise<ApiResult<ApiKey>> {
  return request<ApiKey>(`/internal/api-keys/${encodeURIComponent(id)}`, { accessToken });
}

export async function createApiKey(
  input: CreateApiKeyInput,
  accessToken: string,
): Promise<ApiResult<CreateApiKeyResult>> {
  return request<CreateApiKeyResult>('/internal/api-keys', {
    method: 'POST',
    body: input,
    accessToken,
  });
}

export async function updateApiKey(
  id: string,
  input: UpdateApiKeyInput,
  accessToken: string,
): Promise<ApiResult<ApiKey>> {
  return request<ApiKey>(`/internal/api-keys/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: input,
    accessToken,
  });
}

export async function revokeApiKey(
  id: string,
  reason: string | undefined,
  accessToken: string,
): Promise<ApiResult<ApiKey>> {
  return request<ApiKey>(`/internal/api-keys/${encodeURIComponent(id)}/revoke`, {
    method: 'POST',
    body: { reason },
    accessToken,
  });
}

export async function getApiKeyAuditLogs(
  id: string,
  opts: ListAuditLogsOptions,
  accessToken: string,
): Promise<ApiResult<ApiKeyAuditLog[]>> {
  return request<ApiKeyAuditLog[]>(`/internal/api-keys/${encodeURIComponent(id)}/audit-logs`, {
    query: {
      page: opts.page,
      pageSize: opts.pageSize,
    },
    accessToken,
  });
}

export async function getApiKeyMetrics(
  id: string,
  accessToken: string,
): Promise<ApiResult<Metrics>> {
  return request<Metrics>(`/internal/api-keys/${encodeURIComponent(id)}/metrics`, { accessToken });
}
