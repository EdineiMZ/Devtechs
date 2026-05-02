import { auth } from '@/auth';

/**
 * notifications-api.ts — typed REST wrapper for the notification-service
 * (services/notification-service, default port 4005).
 *
 * Schema reconciliation: the actual Prisma `Notification` model uses
 * `link` (not `actionUrl`), `read: boolean` + `readAt`, and a free-form
 * `type: string` (not an enum). This wrapper preserves the wire format
 * and exposes a single `Notification` shape the rest of the UI consumes.
 *
 * The backend exposes:
 *   - GET    /notifications?unread=&page=&pageSize=
 *   - PUT    /notifications/:id/read
 *   - PUT    /notifications/read-all
 * No DELETE endpoint — `dismissNotification` is a UI-only concept that
 * marks-and-hides client-side, surfaced as `markRead` + local state.
 *
 * Real-time delivery uses the existing Socket.io gateway in the
 * `/notifications` namespace (see `use-notifications-stream` hook),
 * not a separate SSE endpoint — single transport, single auth flow.
 */

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  /** Free-form type key, e.g. "vacation.approved", "ticket.replied",
   *  "invoice.due", "system.welcome". The frontend branches on the
   *  prefix to pick an icon and a route. */
  type: string;
  read: boolean;
  readAt: string | null;
  link: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: Notification[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  unreadCount: number;
}

export interface ListNotificationsFilter {
  unread?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | { message?: string | string[]; error?: string };
}

export function getNotificationServiceUrl(): string {
  return (
    process.env.NOTIFICATION_SERVICE_URL ??
    process.env.NEXT_PUBLIC_NOTIFICATION_URL ??
    'http://127.0.0.1:4005'
  );
}

async function resolveToken(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  if (typeof window !== 'undefined') {
    throw new Error('notifications-api: client-side calls require an explicit accessToken');
  }
  const session = await auth();
  if (!session?.accessToken) throw new Error('notifications-api: no active session');
  return session.accessToken;
}

async function request<T>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined>;
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

  const url = `${getNotificationServiceUrl()}${path}${params}`;
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
    return { ok: false, status: 503, data: { message: 'notification-service indisponível' } };
  }

  let data: T | { message?: string };
  try {
    data = (await res.json()) as T;
  } catch {
    data = { message: 'Resposta invalida do notification-service' };
  }
  return { ok: res.ok, status: res.status, data };
}

// ---------- public functions ----------

export async function listNotifications(
  filter: ListNotificationsFilter = {},
  accessToken?: string,
): Promise<ApiResult<NotificationListResponse>> {
  return request<NotificationListResponse>('/notifications', {
    query: {
      unread: filter.unread,
      page: filter.page,
      pageSize: filter.pageSize,
    },
    accessToken,
  });
}

export async function markRead(
  id: string,
  accessToken?: string,
): Promise<ApiResult<Notification>> {
  return request<Notification>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PUT',
    accessToken,
  });
}

export async function markAllRead(
  accessToken?: string,
): Promise<ApiResult<{ updated: number }>> {
  return request<{ updated: number }>('/notifications/read-all', {
    method: 'PUT',
    accessToken,
  });
}

// ── Preferences ──────────────────────────────────────────────────────────────

export interface NotificationPreferences {
  email: {
    invoice:       boolean;
    login:         boolean;
    accountChange: boolean;
    support:       boolean;
    rh:            boolean;
    system:        boolean;
  };
  inapp: {
    invoice:       boolean;
    login:         boolean;
    accountChange: boolean;
    support:       boolean;
    rh:            boolean;
    system:        boolean;
  };
}

export async function getNotificationPreferences(
  accessToken?: string,
): Promise<ApiResult<NotificationPreferences>> {
  return request<NotificationPreferences>('/notifications/preferences', { accessToken });
}

export async function updateNotificationPreferences(
  prefs: Partial<Record<string, boolean>>,
  accessToken?: string,
): Promise<ApiResult<NotificationPreferences>> {
  return request<NotificationPreferences>('/notifications/preferences', {
    method: 'PUT',
    body: prefs,
    accessToken,
  });
}

// ── Dismiss ───────────────────────────────────────────────────────────────────

/**
 * "Dismiss" a notification.
 *
 * The notification-service does NOT expose a DELETE endpoint —
 * the inbox is append-only by design. We honor the contract by
 * marking the notification as read (so it disappears from the
 * unread filter) and returning success. The caller is expected
 * to drop it from local state if they want it gone visually.
 */
export async function dismissNotification(
  id: string,
  accessToken?: string,
): Promise<ApiResult<Notification>> {
  return markRead(id, accessToken);
}
