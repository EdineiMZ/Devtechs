import { auth } from '@/auth';

/**
 * support-api.ts — typed REST wrapper for the support-service.
 *
 * Mirrors the controller in
 * `services/support-service/src/modules/tickets/tickets.controller.ts`
 * and the DTO definitions under `dto/ticket.dto.ts`. Backend uses
 * `WAITING_CLIENT` (not `WAITING_CUSTOMER`) — this file uses the
 * canonical backend literal so the wire format stays in sync.
 *
 * Every function takes an optional `accessToken`. When omitted from
 * a server component, we read it from `await auth()`. Client-side
 * callers must pass the token explicitly because `auth()` is a
 * server-only API.
 */

export const TICKET_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CLIENT',
  'RESOLVED',
  'CLOSED',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_CATEGORIES = [
  'BUG',
  'FEATURE',
  'QUESTION',
  'BILLING',
  'OTHER',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export interface TicketUserDto {
  id: string;
  name: string | null;
  email: string;
}

export interface TicketAttachmentDto {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  isPrivate?: boolean;
}

export interface TicketMessageDto {
  id: string;
  body: string;
  isInternal: boolean;
  author: TicketUserDto;
  attachments: TicketAttachmentDto[];
  createdAt: string;
}

export interface TicketListItemDto {
  id: string;
  number: number;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  /** null for guest/external tickets submitted via the public contact form */
  client: TicketUserDto | null;
  assignee: TicketUserDto | null;
  slaDeadline: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  rating: number | null;
  tags: string[];
  guestName: string | null;
  guestEmail: string | null;
  messageCount: number;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TicketDetailDto extends TicketListItemDto {
  description: string;
  ratingComment: string | null;
  messages: TicketMessageDto[];
  attachments: TicketAttachmentDto[];
}

export interface TicketListResponseDto {
  items: TicketListItemDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListTicketsFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assigneeId?: string;
  /** Backend uses `clientId` for the requester filter. */
  clientId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateTicketInput {
  title: string;
  description: string;
  priority?: TicketPriority;
  category?: TicketCategory;
  tags?: string[];
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | { message?: string | string[]; error?: string };
}

/** Public env var with sensible default matching the .env. */
export function getSupportServiceUrl(): string {
  return (
    process.env.SUPPORT_SERVICE_URL ??
    process.env.NEXT_PUBLIC_SUPPORT_URL ??
    process.env.NEXT_PUBLIC_SUPPORT_SERVICE_URL ??
    'http://127.0.0.1:4008'
  );
}

/** Resolve the bearer token: caller-provided wins, otherwise from session. */
async function resolveToken(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  // `auth()` is server-only. If we're somehow on the client without an
  // explicit token, fail fast — the caller forgot to thread it.
  if (typeof window !== 'undefined') {
    throw new Error(
      'support-api: client-side calls require an explicit accessToken',
    );
  }
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error('support-api: no active session');
  }
  return session.accessToken;
}

/**
 * Generic fetch — `cache: 'no-store'` because every endpoint here
 * carries user-specific data that must NOT survive build / ISR.
 */
async function request<T>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | undefined>;
    accessToken?: string;
  } = {},
): Promise<ApiResult<T>> {
  const token = await resolveToken(init.accessToken);

  const params = init.query
    ? '?' +
      Object.entries(init.query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(
          ([k, v]) =>
            `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
        )
        .join('&')
    : '';

  const url = `${getSupportServiceUrl()}${path}${params}`;
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
    return { ok: false, status: 503, data: { message: 'support-service indisponível' } };
  }

  let data: T | { message?: string };
  try {
    data = (await res.json()) as T;
  } catch {
    data = { message: 'Resposta invalida do support-service' };
  }
  return { ok: res.ok, status: res.status, data };
}

// ---------- public functions ----------

export async function listTickets(
  filters: ListTicketsFilters = {},
  accessToken?: string,
): Promise<ApiResult<TicketListResponseDto>> {
  return request<TicketListResponseDto>('/tickets', {
    query: filters as Record<string, string | number | undefined>,
    accessToken,
  });
}

export async function getTicket(
  id: string,
  accessToken?: string,
): Promise<ApiResult<TicketDetailDto>> {
  return request<TicketDetailDto>(`/tickets/${encodeURIComponent(id)}`, {
    accessToken,
  });
}

export async function createTicket(
  input: CreateTicketInput,
  accessToken?: string,
): Promise<ApiResult<TicketDetailDto>> {
  return request<TicketDetailDto>('/tickets', {
    method: 'POST',
    body: input,
    accessToken,
  });
}

/** Backend `addMessage` accepts the full body persisted by REST. */
export async function listMessages(
  ticketId: string,
  accessToken?: string,
): Promise<TicketMessageDto[]> {
  // The detail endpoint already includes messages — reuse it instead
  // of duplicating a list endpoint that doesn't exist.
  const res = await getTicket(ticketId, accessToken);
  if (!res.ok) return [];
  return (res.data as TicketDetailDto).messages ?? [];
}

export async function assignTicket(
  id: string,
  assigneeId: string,
  accessToken?: string,
): Promise<ApiResult<TicketDetailDto>> {
  return request<TicketDetailDto>(`/tickets/${encodeURIComponent(id)}/assign`, {
    method: 'PUT',
    body: { assigneeId },
    accessToken,
  });
}

export async function updateStatus(
  id: string,
  status: TicketStatus,
  accessToken?: string,
): Promise<ApiResult<TicketDetailDto>> {
  return request<TicketDetailDto>(`/tickets/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    body: { status },
    accessToken,
  });
}

export async function closeTicket(
  id: string,
  accessToken?: string,
): Promise<ApiResult<TicketDetailDto>> {
  return request<TicketDetailDto>(`/tickets/${encodeURIComponent(id)}/close`, {
    method: 'PUT',
    accessToken,
  });
}

/**
 * Upload a file attachment to a ticket. Uses multipart/form-data.
 * Must be called client-side with an explicit `accessToken`.
 */
export async function uploadAttachment(
  ticketId: string,
  file: File,
  accessToken: string,
  messageId?: string,
  isPrivate?: boolean,
): Promise<ApiResult<TicketAttachmentDto>> {
  const form = new FormData();
  form.append('file', file);

  const params = new URLSearchParams();
  if (messageId) params.set('messageId', messageId);
  if (isPrivate) params.set('isPrivate', 'true');
  const qs = params.toString() ? `?${params.toString()}` : '';

  const url = `${getSupportServiceUrl()}/tickets/${encodeURIComponent(ticketId)}/attachments${qs}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  let data: TicketAttachmentDto | { message?: string };
  try {
    data = (await res.json()) as TicketAttachmentDto;
  } catch {
    data = { message: 'Upload failed' };
  }
  return { ok: res.ok, status: res.status, data };
}

/**
 * Download URL for an attachment.
 * Routes through the Next.js authenticated proxy at /api/download/
 * so the browser session cookie is exchanged for a bearer token.
 * (The /api/support/ path is intercepted by nginx before Next.js.)
 */
export function getAttachmentUrl(ticketId: string, attachmentId: string): string {
  return `/api/download/${encodeURIComponent(ticketId)}/${encodeURIComponent(attachmentId)}`;
}

/**
 * Knowledge base list — there's no `/kb` endpoint in the current
 * support-service so this returns an empty array. Kept here so the
 * UI surface for KB lookups can land without a contract change.
 */
export async function listKb(
  _accessToken?: string,
): Promise<Array<{ id: string; title: string; slug: string }>> {
  return [];
}
