'use client';

import { io, type Socket } from 'socket.io-client';

/**
 * Typed contract for the `/support` Socket.io namespace hosted
 * by the support-service. Mirrors the events declared in
 * `services/support-service/src/modules/chat/support.gateway.ts`
 * so the frontend consumer branches on known payload shapes.
 *
 * Keep this file in lock-step with the gateway — a change on
 * either side that isn't reflected here would surface as a silent
 * `any` at the component boundary.
 */

export interface SupportMessageDto {
  id: string;
  ticketId: string;
  body: string;
  isInternal: boolean;
  author: { id: string; name: string; email: string };
  createdAt: string;
}

export interface TypingEntry {
  userId: string;
  name: string;
}

export interface SupportServerEvents {
  connected: (payload: {
    userId: string;
    isAgent: boolean;
    displayName: string;
  }) => void;
  'ticket:joined': (payload: {
    ticketId: string;
    number: number;
    status: string;
  }) => void;
  'message:new': (message: SupportMessageDto) => void;
  'ticket:status': (payload: {
    ticketId: string;
    from: string;
    to: string;
  }) => void;
  'user:typing': (payload: {
    ticketId: string;
    typers: TypingEntry[];
  }) => void;
  'user:joined': (payload: {
    ticketId: string;
    user: { id: string; name: string };
  }) => void;
  error: (payload: { code: string; message: string }) => void;
}

export interface SupportClientEvents {
  'ticket:join': (payload: { ticketId: string }) => void;
  'ticket:leave': (payload: { ticketId: string }) => void;
  'message:send': (payload: {
    ticketId: string;
    body: string;
    isInternal?: boolean;
  }) => void;
  'typing:start': (payload: { ticketId: string }) => void;
  'typing:stop': (payload: { ticketId: string }) => void;
}

/**
 * The full typed Socket.io client. Consumers pass it to
 * `useEffect` and the attached `.on(...)` handlers get the
 * precise event payload as their argument.
 */
export type SupportSocket = Socket<
  SupportServerEvents,
  SupportClientEvents
>;

/** Where the support-service Socket.io endpoint lives. */
function getSupportSocketUrl(): string {
  // Accept both env var names — `NEXT_PUBLIC_SUPPORT_URL` is the one set
  // in the repo `.env`, while older code referenced
  // `NEXT_PUBLIC_SUPPORT_SERVICE_URL`. Default port aligns with
  // `SUPPORT_SERVICE_PORT=4008` in `.env`.
  return (
    process.env.NEXT_PUBLIC_SUPPORT_SERVICE_URL ??
    process.env.NEXT_PUBLIC_SUPPORT_URL ??
    'http://127.0.0.1:4008'
  );
}

/**
 * Build a Socket.io client bound to the `/support` namespace.
 *
 * Authentication: the access token is handed to the server via
 * the `auth` object on the handshake, which the gateway reads
 * with jwt.verify. We prefer this over the query-string form
 * because it's opaque to server logs and avoids accidentally
 * leaking the token into analytics middleware.
 *
 * Transport: we list `websocket` first so well-behaved clients
 * skip long-polling entirely. Fall back to polling automatically
 * on networks where WebSocket upgrade is blocked.
 *
 * This function does NOT call `.connect()` — the caller decides
 * when to open the socket (usually inside a useEffect that tears
 * it down on unmount).
 */
export function createSupportSocket(accessToken: string): SupportSocket {
  return io(`${getSupportSocketUrl()}/support`, {
    auth: { token: accessToken },
    transports: ['websocket', 'polling'],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  }) as SupportSocket;
}
