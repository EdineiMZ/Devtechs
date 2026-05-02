import { auth } from '@/auth';

/**
 * finance-api.ts — typed REST wrapper for the finance-service
 * (services/finance-service, default port 4004).
 *
 * Schema reconciliation: the actual Prisma `Invoice` model uses
 * `subtotal | tax | total`, `dueDate`, and a `DRAFT|SENT|PAID|
 * OVERDUE|CANCELLED` status enum. The frontend spec talks about
 * `amount`, `dueAt`, and `PENDING|PAID|OVERDUE|CANCELED`. This
 * wrapper translates the wire format into a single `Invoice`
 * shape the rest of the UI consumes — `amount` always carries
 * `total`, `dueAt` is `dueDate`, and `PENDING` is rendered for
 * `DRAFT` / `SENT` (waiting-on-payment states).
 *
 * Permissions: staff with `finance:invoices:issue` see all invoices.
 * Clients without that permission are automatically scoped to their own
 * invoices by the backend (clientId forced to self). Both admin and
 * client paths pass clientId as a query param for server-side filtering.
 */

export const RAW_INVOICE_STATUSES = [
  'DRAFT',
  'SENT',
  'PAID',
  'OVERDUE',
  'CANCELLED',
  'REFUNDED',
] as const;
export type RawInvoiceStatus = (typeof RAW_INVOICE_STATUSES)[number];

/** UI-facing status */
export type UiInvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED' | 'REFUNDED';

export interface InvoiceClient {
  id: string;
  name: string;
  email: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceProject {
  id: string;
  name: string;
}

export interface RawInvoice {
  id: string;
  number: string;
  client: InvoiceClient | null;
  project: InvoiceProject | null;
  projectId: string | null;
  subtotal: number;
  tax: number;
  total: number;
  status: RawInvoiceStatus;
  issuedAt: string;
  dueDate: string;
  paidAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  cancelReason: string | null;
  notes: string | null;
  items: InvoiceItem[];
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  number: string;
  description: string;
  client: InvoiceClient | null;
  project: InvoiceProject | null;
  projectId: string | null;
  amount: number;
  subtotal: number;
  tax: number;
  status: UiInvoiceStatus;
  rawStatus: RawInvoiceStatus;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  cancelReason: string | null;
  notes: string | null;
  items: InvoiceItem[];
  hasPdf: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentCondition {
  id: string;
  name: string;
  description: string | null;
  installments: number;
  interestRate: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListInvoicesFilter {
  clientId?: string;
  projectId?: string;
  status?: UiInvoiceStatus;
}

export interface RequestPaymentResponse {
  checkoutUrl: string;
}

export interface PixPaymentResponse {
  paymentId: string;
  method: 'pix';
  status: string;
  pixQrCode: string | null;
  pixQrCodeBase64: string | null;
}

export interface CardPaymentResponse {
  paymentId: string;
  method: 'card';
  status: string;
  /** Mercado Pago status_detail code, e.g. "cc_rejected_insufficient_amount". */
  statusDetail: string | null;
}

export type CheckoutResponse = PixPaymentResponse | CardPaymentResponse;

export interface CreateInvoiceInput {
  clientId: string;
  projectId?: string;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  tax?: number;
  dueDate: string;
  issuedAt?: string;
  notes?: string;
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | { message?: string | string[]; error?: string };
}

export function getFinanceServiceUrl(): string {
  return (
    process.env.FINANCE_SERVICE_URL ??
    process.env.NEXT_PUBLIC_FINANCE_URL ??
    'http://127.0.0.1:4004'
  );
}

async function resolveToken(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  if (typeof window !== 'undefined') {
    throw new Error('finance-api: client-side calls require an explicit accessToken');
  }
  const session = await auth();
  if (!session?.accessToken) throw new Error('finance-api: no active session');
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
    data = { message: 'Resposta invalida do finance-service' };
  }
  return { ok: res.ok, status: res.status, data };
}

/** Map the wire-format invoice into the UI-friendly shape. */
export function normalizeInvoice(raw: RawInvoice): Invoice {
  const status = mapStatus(raw.status, raw.dueDate, raw.paidAt);
  const description = raw.items[0]?.description
    ? raw.items.length > 1
      ? `${raw.items[0]!.description} (+${raw.items.length - 1} itens)`
      : raw.items[0]!.description
    : 'Fatura';
  return {
    id: raw.id,
    number: raw.number,
    description,
    client: raw.client,
    project: raw.project ?? null,
    projectId: raw.projectId ?? null,
    amount: raw.total,
    subtotal: raw.subtotal,
    tax: raw.tax,
    status,
    rawStatus: raw.status,
    issuedAt: raw.issuedAt,
    dueAt: raw.dueDate,
    paidAt: raw.paidAt,
    cancelledAt: raw.cancelledAt ?? null,
    refundedAt: raw.refundedAt ?? null,
    cancelReason: raw.cancelReason ?? null,
    notes: raw.notes,
    items: raw.items,
    hasPdf: true,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Backend uses CANCELLED (double L) and lumps DRAFT+SENT under
 * "not yet paid". OVERDUE in the DB means flagged as overdue, but
 * any unpaid invoice past `dueDate` should also surface as OVERDUE
 * to the client even if the cron hasn't flipped the flag yet.
 */
function mapStatus(
  raw: RawInvoiceStatus,
  dueDate: string,
  paidAt: string | null,
): UiInvoiceStatus {
  if (raw === 'PAID') return 'PAID';
  if (raw === 'CANCELLED') return 'CANCELED';
  if (raw === 'REFUNDED') return 'REFUNDED';
  if (raw === 'OVERDUE') return 'OVERDUE';
  // DRAFT / SENT — figure out if it's already past due.
  if (!paidAt && new Date(dueDate).getTime() < Date.now()) return 'OVERDUE';
  return 'PENDING';
}

// ---------- public functions ----------

async function requestWithQuery<T>(
  path: string,
  query: Record<string, string | undefined>,
  init: { method?: string; body?: unknown; accessToken?: string } = {},
): Promise<ApiResult<T>> {
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`)
    .join('&');
  return request<T>(qs ? `${path}?${qs}` : path, init);
}

export async function listInvoices(
  filter: ListInvoicesFilter = {},
  accessToken?: string,
): Promise<ApiResult<Invoice[]>> {
  const res = await requestWithQuery<RawInvoice[]>(
    '/invoices',
    { projectId: filter.projectId, clientId: filter.clientId },
    { accessToken },
  );
  if (!res.ok) {
    return { ok: false, status: res.status, data: res.data as { message?: string } };
  }
  let normalized = (Array.isArray(res.data) ? res.data : []).map(normalizeInvoice);
  if (filter.status) {
    normalized = normalized.filter((inv) => inv.status === filter.status);
  }
  return { ok: true, status: res.status, data: normalized };
}

export async function createInvoice(
  input: CreateInvoiceInput,
  accessToken?: string,
): Promise<ApiResult<Invoice>> {
  const res = await request<RawInvoice>('/invoices', {
    method: 'POST',
    body: input,
    accessToken,
  });
  if (!res.ok) return { ok: false, status: res.status, data: res.data as { message?: string } };
  return { ok: true, status: res.status, data: normalizeInvoice(res.data as RawInvoice) };
}

/**
 * Initiate transparent Mercado Pago checkout for an invoice.
 * For PIX: returns QR code data. For card: requires token from MP.js SDK.
 */
export async function checkoutInvoice(
  invoiceId: string,
  payload: { method: 'pix' | 'card'; payerEmail?: string; card?: { token: string; installments: string; paymentMethodId?: string } },
  accessToken: string,
): Promise<ApiResult<CheckoutResponse>> {
  return request<CheckoutResponse>(
    `/checkout/invoice/${encodeURIComponent(invoiceId)}`,
    { method: 'POST', body: payload, accessToken },
  );
}

export async function getInvoice(
  id: string,
  accessToken?: string,
): Promise<ApiResult<Invoice>> {
  const res = await request<RawInvoice>(
    `/invoices/${encodeURIComponent(id)}`,
    { accessToken },
  );
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      data: res.data as { message?: string | string[]; error?: string },
    };
  }
  return {
    ok: true,
    status: res.status,
    data: normalizeInvoice(res.data as RawInvoice),
  };
}

/**
 * @deprecated Use checkoutInvoice() for transparent checkout.
 * Kept for backward compatibility with any existing callers.
 */
export async function requestPayment(
  id: string,
  accessToken?: string,
): Promise<ApiResult<RequestPaymentResponse>> {
  return request<RequestPaymentResponse>(
    `/checkout/invoice/${encodeURIComponent(id)}`,
    { method: 'POST', body: { method: 'pix' }, accessToken },
  );
}

export async function cancelInvoice(
  id: string,
  reason: string | undefined,
  accessToken: string,
): Promise<ApiResult<Invoice>> {
  const res = await request<RawInvoice>(
    `/invoices/${encodeURIComponent(id)}/cancel`,
    { method: 'POST', body: { reason }, accessToken },
  );
  if (!res.ok) return { ok: false, status: res.status, data: res.data as { message?: string } };
  return { ok: true, status: res.status, data: normalizeInvoice(res.data as RawInvoice) };
}

export async function refundInvoice(
  id: string,
  reason: string | undefined,
  accessToken: string,
): Promise<ApiResult<Invoice>> {
  const res = await request<RawInvoice>(
    `/invoices/${encodeURIComponent(id)}/refund`,
    { method: 'POST', body: { reason }, accessToken },
  );
  if (!res.ok) return { ok: false, status: res.status, data: res.data as { message?: string } };
  return { ok: true, status: res.status, data: normalizeInvoice(res.data as RawInvoice) };
}

// ---------- Payment Conditions ----------

export async function listPaymentConditions(
  activeOnly = false,
  accessToken?: string,
): Promise<ApiResult<PaymentCondition[]>> {
  return request<PaymentCondition[]>(
    `/payment-conditions${activeOnly ? '?active=true' : ''}`,
    { accessToken },
  );
}

export async function createPaymentCondition(
  input: Omit<PaymentCondition, 'id' | 'createdAt' | 'updatedAt'>,
  accessToken: string,
): Promise<ApiResult<PaymentCondition>> {
  return request<PaymentCondition>('/payment-conditions', {
    method: 'POST',
    body: input,
    accessToken,
  });
}

export async function updatePaymentCondition(
  id: string,
  input: Partial<Omit<PaymentCondition, 'id' | 'createdAt' | 'updatedAt'>>,
  accessToken: string,
): Promise<ApiResult<PaymentCondition>> {
  return request<PaymentCondition>(`/payment-conditions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: input,
    accessToken,
  });
}

export async function deletePaymentCondition(
  id: string,
  accessToken: string,
): Promise<ApiResult<{ message: string; id: string }>> {
  return request<{ message: string; id: string }>(
    `/payment-conditions/${encodeURIComponent(id)}`,
    { method: 'DELETE', accessToken },
  );
}
