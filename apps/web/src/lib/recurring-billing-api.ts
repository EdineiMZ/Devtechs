import { auth } from '@/auth';
import { getFinanceServiceUrl } from './finance-api';

export interface BillingProduct {
  id: string;
  name: string;
  description: string | null;
  unitPrice: number;
  unit: string;
  category: string | null;
  isActive: boolean;
  isLicensed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringSubscriptionItem {
  id: string;
  productId: string | null;
  product: { id: string; name: string; category?: string } | null;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type RecurringSubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'SUSPENDED';

export interface RecurringSubscription {
  id: string;
  clientId: string;
  client: { id: string; name: string; email: string } | null;
  creator: { id: string; name: string } | null;
  name: string;
  description: string | null;
  status: RecurringSubscriptionStatus;
  billingDay: number;
  billingDueDays: number;
  nextBillingDate: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  endsAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: RecurringSubscriptionItem[];
  monthlyTotal: number;
}

interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | { message?: string };
}

async function resolveToken(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  if (typeof window !== 'undefined') {
    throw new Error('recurring-billing-api: client-side calls require an explicit accessToken');
  }
  const session = await auth();
  if (!session?.accessToken) throw new Error('recurring-billing-api: no active session');
  return session.accessToken;
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; accessToken?: string } = {},
): Promise<ApiResult<T>> {
  const token = await resolveToken(init.accessToken);
  const url = `${getFinanceServiceUrl()}${path}`;
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
    return { ok: false, status: 503, data: { message: 'finance-service indisponível' } };
  }
  let data: T | { message?: string };
  try {
    data = (await res.json()) as T;
  } catch {
    data = { message: 'Resposta inválida' };
  }
  return { ok: res.ok, status: res.status, data };
}

// ─────────────────────────── Products ────────────────────────────

export async function listBillingProducts(
  params?: { activeOnly?: boolean; licensedOnly?: boolean; accessToken?: string },
): Promise<ApiResult<BillingProduct[]>> {
  const qs = new URLSearchParams();
  if (params?.activeOnly) qs.set('active', 'true');
  if (params?.licensedOnly) qs.set('licensed', 'true');
  const qsStr = qs.toString() ? `?${qs.toString()}` : '';
  return request<BillingProduct[]>(`/recurring-billing/products${qsStr}`, {
    accessToken: params?.accessToken,
  });
}

export async function createBillingProduct(
  body: Omit<BillingProduct, 'id' | 'createdAt' | 'updatedAt'>,
  accessToken?: string,
): Promise<ApiResult<BillingProduct>> {
  return request<BillingProduct>('/recurring-billing/products', {
    method: 'POST',
    body,
    accessToken,
  });
}

export async function updateBillingProduct(
  id: string,
  body: Partial<Omit<BillingProduct, 'id' | 'createdAt' | 'updatedAt'>>,
  accessToken?: string,
): Promise<ApiResult<BillingProduct>> {
  return request<BillingProduct>(`/recurring-billing/products/${id}`, {
    method: 'PUT',
    body,
    accessToken,
  });
}

export async function deactivateBillingProduct(
  id: string,
  accessToken?: string,
): Promise<ApiResult<{ message: string; id: string }>> {
  return request<{ message: string; id: string }>(`/recurring-billing/products/${id}`, {
    method: 'DELETE',
    accessToken,
  });
}

// ─────────────────────────── Subscriptions ────────────────────────────

export async function listRecurringSubscriptions(
  params?: { clientId?: string; status?: string; accessToken?: string },
): Promise<ApiResult<RecurringSubscription[]>> {
  const qs = new URLSearchParams();
  if (params?.clientId) qs.set('clientId', params.clientId);
  if (params?.status) qs.set('status', params.status);
  const qsStr = qs.toString() ? `?${qs.toString()}` : '';
  return request<RecurringSubscription[]>(`/recurring-billing/subscriptions${qsStr}`, {
    accessToken: params?.accessToken,
  });
}

export async function getRecurringSubscription(
  id: string,
  accessToken?: string,
): Promise<ApiResult<RecurringSubscription>> {
  return request<RecurringSubscription>(`/recurring-billing/subscriptions/${id}`, {
    accessToken,
  });
}

export interface CreateRecurringSubscriptionBody {
  clientId: string;
  name: string;
  description?: string;
  billingDay: number;
  billingDueDays?: number;
  nextBillingDate: string;
  notes?: string;
  items: Array<{
    productId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export async function createRecurringSubscription(
  body: CreateRecurringSubscriptionBody,
  accessToken?: string,
): Promise<ApiResult<RecurringSubscription>> {
  return request<RecurringSubscription>('/recurring-billing/subscriptions', {
    method: 'POST',
    body,
    accessToken,
  });
}

export async function cancelRecurringSubscription(
  id: string,
  body: { reason?: string; immediate?: boolean },
  accessToken?: string,
): Promise<ApiResult<RecurringSubscription>> {
  return request<RecurringSubscription>(`/recurring-billing/subscriptions/${id}/cancel`, {
    method: 'POST',
    body,
    accessToken,
  });
}
