'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import {
  markAllRead as apiMarkAllRead,
  markRead as apiMarkRead,
  type Notification,
} from '@/lib/notifications-api';

/**
 * Live notifications hook.
 *
 * Real-time transport: the notification-service exposes a Socket.io
 * gateway on the `/notifications` namespace (see
 * `services/notification-service/src/modules/notification/notification.gateway.ts`).
 * Every authenticated socket joins a room named after the user id;
 * the consumer pushes a `notification` event whenever a new row
 * lands. We reuse this transport instead of adding a parallel SSE
 * endpoint — one auth flow, one message contract.
 *
 * The hook owns the socket lifecycle: open on mount with the JWT
 * passed via `auth.token`, listen for `notification` and `connected`
 * events, tear down on unmount. Optimistic updates for `markRead`
 * and `markAllRead` keep the UI snappy; the REST roundtrip
 * reconciles afterwards (any error rolls the optimism back).
 */
export interface UseNotificationsStreamOptions {
  /** Server-side fetched notifications used to seed the feed so
   *  the first paint already has data even before the socket
   *  fires its first event. */
  initialNotifications: Notification[];
  /** Server-side unreadCount snapshot — same reasoning as above. */
  initialUnreadCount: number;
  accessToken: string;
  /** Where the notification-service Socket.io endpoint lives.
   *  Defaults to `NEXT_PUBLIC_NOTIFICATION_URL`. */
  serviceUrl?: string;
}

export interface UseNotificationsStreamResult {
  notifications: Notification[];
  unreadCount: number;
  connected: boolean;
  error: string | null;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  /** Pushes a notification into the local feed without going
   *  through the socket — useful for tests and optimistic UI when
   *  another component already has the payload. */
  pushLocal: (notification: Notification) => void;
}

/**
 * Resolve the socket.io endpoint for the `/notifications` namespace.
 *
 * Same shape as the support gateway: in production we connect to the
 * page's own origin and route engine.io under `/api/notifications/socket.io/`
 * so HTTPS pages naturally upgrade to `wss://` (no Mixed Content). The prod
 * `NEXT_PUBLIC_NOTIFICATION_URL=https://szdevs.com/api/notifications`
 * describes the REST gateway and would mangle the websocket path, so we
 * ignore env values that contain `/api/` and only honor explicit dev
 * overrides that point straight at the service.
 */
function resolveNotificationTarget(serviceUrl?: string): {
  url: string;
  path: string;
} {
  const override = serviceUrl ?? process.env.NEXT_PUBLIC_NOTIFICATION_URL;
  if (
    override &&
    !override.includes('/api/') &&
    (override.startsWith('http://') || override.startsWith('https://'))
  ) {
    return { url: `${override}/notifications`, path: '/socket.io/' };
  }
  return { url: '/notifications', path: '/api/notifications/socket.io/' };
}

export function useNotificationsStream({
  initialNotifications,
  initialUnreadCount,
  accessToken,
  serviceUrl,
}: UseNotificationsStreamOptions): UseNotificationsStreamResult {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  // ------------------------------------------------------------
  // Socket lifecycle
  // ------------------------------------------------------------

  useEffect(() => {
    if (!accessToken) return;

    const target = resolveNotificationTarget(serviceUrl);
    const socket = io(target.url, {
      path: target.path,
      transports: ['websocket', 'polling'],
      auth: { token: accessToken },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err: Error) => {
      setError(err.message);
    });
    socket.on('error', (payload: { message?: string } | string) => {
      const message = typeof payload === 'string' ? payload : payload?.message;
      if (message) setError(message);
    });

    // Server emits `notification` when a new row is persisted for
    // this user. Append + bump unreadCount.
    socket.on('notification', (incoming: Notification) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === incoming.id)) return prev;
        return [incoming, ...prev];
      });
      if (!incoming.read) {
        setUnreadCount((c) => c + 1);
      }
    });

    socketRef.current = socket;
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, serviceUrl]);

  // ------------------------------------------------------------
  // Actions (optimistic + REST reconcile)
  // ------------------------------------------------------------

  const markRead = useCallback(
    async (id: string) => {
      // Snapshot for rollback.
      let wasUnread = false;
      setNotifications((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n;
          if (!n.read) wasUnread = true;
          return { ...n, read: true, readAt: new Date().toISOString() };
        }),
      );
      if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));

      const res = await apiMarkRead(id, accessToken);
      if (!res.ok) {
        // Rollback on failure — the badge should match server truth.
        setNotifications((prev) =>
          prev.map((n) => {
            if (n.id !== id) return n;
            if (!wasUnread) return n;
            return { ...n, read: false, readAt: null };
          }),
        );
        if (wasUnread) setUnreadCount((c) => c + 1);
      }
    },
    [accessToken],
  );

  const markAllRead = useCallback(async () => {
    const previousNotifications = notifications;
    const previousUnread = unreadCount;
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.read ? n : { ...n, read: true, readAt: now })),
    );
    setUnreadCount(0);

    const res = await apiMarkAllRead(accessToken);
    if (!res.ok) {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnread);
    }
  }, [notifications, unreadCount, accessToken]);

  const pushLocal = useCallback((notification: Notification) => {
    setNotifications((prev) => {
      if (prev.some((n) => n.id === notification.id)) return prev;
      return [notification, ...prev];
    });
    if (!notification.read) setUnreadCount((c) => c + 1);
  }, []);

  return {
    notifications,
    unreadCount,
    connected,
    error,
    markRead,
    markAllRead,
    pushLocal,
  };
}
