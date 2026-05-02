import { auth } from '@/auth';

/**
 * license-api.ts — typed REST wrapper for the license-service (port 4007).
 *
 * Covers products, client bindings, and activation tokens.
 * Server-only by default; pass an explicit accessToken for client-side calls
 * (e.g. dialogs that call Next.js Server Actions).
 */

export function getLicenseServiceUrl(): string {
  return (
    process.env.LICENSE_SERVICE_URL ??
    process.env.NEXT_PUBLIC_LICENSE_URL ??
    'http://127.0.0.1:4007'
  );
}

async function resolveToken(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  if (typeof window !== 'undefined') {
    throw new Error('license-api: client-side calls require an explicit accessToken');
  }
  const session = await auth();
  if (!session?.accessToken) throw new Error('license-api: no active session');
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

  const url = `${getLicenseServiceUrl()}${path}${params}`;
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
    return { ok: false, status: 503, data: { message: 'license-service indisponível' } };
  }

  let data: T | { message?: string };
  try {
    data = (await res.json()) as T;
  } catch {
    data = { message: 'Resposta inválida do license-service' };
  }
  return { ok: res.ok, status: res.status, data };
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | { message?: string | string[]; error?: string };
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export interface LicensedProduct {
  id: string;
  name: string;
  description: string | null;
  appId: string;
  createdAt: string;
  _count?: { bindings: number; activationTokens: number };
}

export interface CreateProductInput {
  name: string;
  appId: string;
  description?: string;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
}

export async function listProducts(
  accessToken?: string,
): Promise<ApiResult<LicensedProduct[]>> {
  return request<LicensedProduct[]>('/products', { accessToken });
}

export async function createProduct(
  input: CreateProductInput,
  accessToken?: string,
): Promise<ApiResult<LicensedProduct>> {
  return request<LicensedProduct>('/products', {
    method: 'POST',
    body: input,
    accessToken,
  });
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
  accessToken?: string,
): Promise<ApiResult<LicensedProduct>> {
  return request<LicensedProduct>(`/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: input,
    accessToken,
  });
}

// ---------------------------------------------------------------------------
// Client bindings
// ---------------------------------------------------------------------------

export interface BindClientInput {
  productId: string;
}

export interface ClientBinding {
  id: string;
  clientId: string;
  productId: string;
  assignedAt: string;
  revokedAt: string | null;
}

export async function bindClient(
  clientId: string,
  input: BindClientInput,
  accessToken?: string,
): Promise<ApiResult<ClientBinding>> {
  return request<ClientBinding>(`/clients/${encodeURIComponent(clientId)}/bind`, {
    method: 'POST',
    body: input,
    accessToken,
  });
}

export async function listClientTokens(
  clientId: string,
  accessToken?: string,
): Promise<ApiResult<ActivationToken[]>> {
  return request<ActivationToken[]>(`/clients/${encodeURIComponent(clientId)}/tokens`, {
    accessToken,
  });
}

// ---------------------------------------------------------------------------
// Activation tokens
// ---------------------------------------------------------------------------

export type TokenStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface TokenActivation {
  id: string;
  hardwareId: string | null;
  appVersion: string | null;
  ipAddress: string | null;
  activatedAt: string;
}

export interface ActivationToken {
  id: string;
  key: string;
  hash: string;
  clientId: string;
  productId: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  hardwareId: string | null;
  status: TokenStatus;
  issuedBy: string;
  issuedAt: string;
  revokedBy: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  product?: LicensedProduct;
  activations?: TokenActivation[];
}

export interface GeneratedToken {
  key: string;
  hash: string;
  expiresAt: string | null;
  maxUses: number | null;
}

export interface CreateTokenInput {
  clientId: string;
  productId: string;
  maxUses?: number;
  expiresAt?: string;
  hardwareId?: string;
}

export interface RevokeTokenInput {
  reason?: string;
}

export interface ListTokensFilters {
  status?: TokenStatus;
  clientId?: string;
  productId?: string;
}

export async function listTokens(
  filters: ListTokensFilters = {},
  accessToken?: string,
): Promise<ApiResult<ActivationToken[]>> {
  return request<ActivationToken[]>('/tokens', {
    query: filters as Record<string, string | undefined>,
    accessToken,
  });
}

export async function createToken(
  input: CreateTokenInput,
  accessToken?: string,
): Promise<ApiResult<GeneratedToken>> {
  return request<GeneratedToken>('/tokens', {
    method: 'POST',
    body: input,
    accessToken,
  });
}

export async function revokeToken(
  tokenId: string,
  input: RevokeTokenInput = {},
  accessToken?: string,
): Promise<ApiResult<ActivationToken>> {
  return request<ActivationToken>(`/tokens/${encodeURIComponent(tokenId)}/revoke`, {
    method: 'PUT',
    body: input,
    accessToken,
  });
}
