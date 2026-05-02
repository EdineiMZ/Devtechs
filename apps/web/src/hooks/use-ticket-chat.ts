'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createSupportSocket,
  type SupportMessageDto,
  type SupportSocket,
  type TypingEntry,
} from '@/lib/support-socket';

/**
 * useTicketChat — React hook that owns the lifecycle of one
 * /support socket scoped to a single ticket.
 *
 * Responsibilities:
 *   - Open the socket on mount with the given access token.
 *   - Emit `ticket:join` as soon as we're connected.
 *   - Append incoming `message:new` events to the messages array.
 *   - Track the live `typers` array (everyone except the caller).
 *   - Track `ticket:status` changes so the UI can flip badges
 *     without a manual reload.
 *   - Debounce `typing:start` (every keystroke refreshes it, a
 *     500ms pause fires `typing:stop`).
 *   - Emit `ticket:leave` and disconnect on unmount so room
 *     membership stays clean even when the user closes the tab.
 *
 * The hook deliberately owns zero rendering — consumers drive
 * the layout. It exposes `sendMessage`, `onKeyStroke`, and the
 * live state as plain values so any component shape can bind.
 */
export interface UseTicketChatOptions {
  ticketId: string;
  accessToken: string;
  /** Seed the messages list from the REST call so the UI can
   *  render the full history even on first load. */
  initialMessages?: SupportMessageDto[];
}

export interface UseTicketChatResult {
  connected: boolean;
  joined: boolean;
  status: string | null;
  messages: SupportMessageDto[];
  typers: TypingEntry[];
  error: { code: string; message: string } | null;
  sendMessage: (body: string, isInternal?: boolean) => void;
  onKeyStroke: () => void;
}

/** Debounce window for typing:stop after the last keystroke. */
const TYPING_DEBOUNCE_MS = 500;

export function useTicketChat({
  ticketId,
  accessToken,
  initialMessages = [],
}: UseTicketChatOptions): UseTicketChatResult {
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessageDto[]>(initialMessages);
  const [typers, setTypers] = useState<TypingEntry[]>([]);
  const [error, setError] = useState<{ code: string; message: string } | null>(
    null,
  );

  const socketRef = useRef<SupportSocket | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // ------------------------------------------------------------
  // Connection lifecycle
  // ------------------------------------------------------------

  useEffect(() => {
    if (!accessToken) return;
    if (!ticketId) return;

    const socket = createSupportSocket(accessToken);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // Don't emit ticket:join yet — wait for the server's 'connected'
      // event which fires AFTER handleConnection finishes setting client.data.
    });
    socket.on('disconnect', () => {
      setConnected(false);
      setJoined(false);
    });

    socket.on('connected', () => {
      // Server has finished authenticating this socket — safe to join.
      socket.emit('ticket:join', { ticketId });
    });

    socket.on('ticket:joined', (payload) => {
      setJoined(true);
      setStatus(payload.status);
    });

    socket.on('message:new', (message) => {
      setMessages((prev) => {
        // Guard against a reconnect that replays the latest
        // message — dedupe on id.
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    socket.on('ticket:status', (payload) => {
      setStatus(payload.to);
    });

    socket.on('user:typing', (payload) => {
      if (payload.ticketId !== ticketId) return;
      setTypers(payload.typers);
    });

    socket.on('user:joined', (_payload) => {
      // Hook emits this as a live "agent online" event — the
      // consumer can toast it if they want.
    });

    socket.on('error', (payload) => {
      setError(payload);
    });

    socket.connect();

    return () => {
      // Clean teardown: tell the server to leave the room, then
      // disconnect. The server also handles a hard disconnect
      // gracefully via handleDisconnect.
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      if (isTypingRef.current) {
        try {
          socket.emit('typing:stop', { ticketId });
        } catch {
          /* socket may already be closing */
        }
        isTypingRef.current = false;
      }
      try {
        socket.emit('ticket:leave', { ticketId });
      } catch {
        /* same */
      }
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [ticketId, accessToken]);

  // ------------------------------------------------------------
  // Sending
  // ------------------------------------------------------------

  const sendMessage = useCallback(
    (body: string, isInternal?: boolean) => {
      const socket = socketRef.current;
      if (!socket || !body.trim()) return;
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      if (isTypingRef.current) {
        socket.emit('typing:stop', { ticketId });
        isTypingRef.current = false;
      }
      socket.emit('message:send', { ticketId, body: body.trim(), isInternal });
    },
    [ticketId],
  );

  const onKeyStroke = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !joined) return;

    if (!isTypingRef.current) {
      socket.emit('typing:start', { ticketId });
      isTypingRef.current = true;
    }

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        socket.emit('typing:stop', { ticketId });
        isTypingRef.current = false;
      }
      typingTimerRef.current = null;
    }, TYPING_DEBOUNCE_MS);
  }, [ticketId, joined]);

  return {
    connected,
    joined,
    status,
    messages,
    typers,
    error,
    sendMessage,
    onKeyStroke,
  };
}
