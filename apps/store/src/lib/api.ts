/**
 * Client for the payments-service REST API.
 * All requests use the user's JWT from the session.
 */

const PAYMENTS_URL =
  process.env.NEXT_PUBLIC_PAYMENTS_URL ?? 'http://127.0.0.1:3010';

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: string; // Decimal serialized as string
  interval: 'MONTHLY' | 'YEARLY';
  features: string[];
  trialDays: number;
  isActive: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | 'TRIALING' | 'EXPIRED';
  externalId: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt: string | null;
  trialEnd: string | null;
  createdAt: string;
  plan: Plan;
  payments: Payment[];
}

export interface Payment {
  id: string;
  subscriptionId: string | null;
  userId: string;
  amount: string;
  currency: string;
  method: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD';
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'EXPIRED';
  externalId: string | null;
  externalUrl: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount: string;
  type: 'PERCENTAGE' | 'FIXED';
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  expiresAt: string | null;
}

export interface CreateSubscriptionResult {
  subscription: Subscription;
  externalUrl: string | null;
}

async function apiFetch<T>(
  path: string,
  token: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${PAYMENTS_URL}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Erro na requisicao' }));
    throw new Error(
      (err as { message?: string | string[] }).message?.toString() ?? `HTTP ${res.status}`,
    );
  }

  return res.json() as Promise<T>;
}

/** Public: no auth required */
export async function fetchPlans(): Promise<Plan[]> {
  const res = await fetch(`${PAYMENTS_URL}/plans`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Falha ao carregar planos');
  return res.json() as Promise<Plan[]>;
}

/** Validate coupon code */
export async function validateCoupon(
  code: string,
  token: string,
): Promise<Coupon> {
  return apiFetch<Coupon>(`/coupons/validate?code=${encodeURIComponent(code)}`, token);
}

/** Create subscription */
export async function createSubscription(
  data: { planId: string; couponCode?: string; method?: string },
  token: string,
): Promise<CreateSubscriptionResult> {
  return apiFetch<CreateSubscriptionResult>('/subscriptions', token, {
    method: 'POST',
    body: data,
  });
}

/** Get current user subscription */
export async function getMySubscription(
  token: string,
): Promise<Subscription | null> {
  try {
    return await apiFetch<Subscription>('/subscriptions/me', token);
  } catch {
    return null;
  }
}

/** Cancel subscription */
export async function cancelSubscription(
  token: string,
): Promise<unknown> {
  return apiFetch('/subscriptions/me', token, { method: 'DELETE' });
}

/** Get payment status (for polling) */
export async function getPaymentStatus(
  paymentId: string,
  token: string,
): Promise<Payment> {
  return apiFetch<Payment>(`/payments/${paymentId}`, token);
}
