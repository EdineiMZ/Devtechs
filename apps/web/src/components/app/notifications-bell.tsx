'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { NotificationItem } from '@/components/notifications/notification-item';
import { useNotificationsStream } from '@/hooks/use-notifications-stream';
import type { Notification } from '@/lib/notifications-api';

export interface NotificationsBellProps {
  initialNotifications: Notification[];
  initialUnreadCount: number;
  accessToken: string;
  serviceUrl?: string;
}

/**
 * Bell-shaped trigger in the topbar. Click toggles a dropdown
 * showing the latest 5 notifications + "Ver todas" link.
 *
 * The bell maintains a live subscription to `/notifications`
 * (Socket.io) for the entire session, so the unread badge stays
 * accurate even when the user is on a non-notifications page.
 */
export function NotificationsBell({
  initialNotifications,
  initialUnreadCount,
  accessToken,
  serviceUrl,
}: NotificationsBellProps): JSX.Element {
  const { notifications, unreadCount, markRead } = useNotificationsStream({
    initialNotifications,
    initialUnreadCount,
    accessToken,
    serviceUrl,
  });

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent): void {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const top5 = notifications.slice(0, 5);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/8 bg-secondary/40 text-ash transition-colors hover:bg-accent hover:text-foreground"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Notificações"
          className="absolute right-0 top-full z-40 mt-2 w-[360px] overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-white/8 bg-secondary/30 px-4 py-3">
            <span className="text-sm font-semibold text-foreground">
              Notificações
            </span>
            {unreadCount > 0 ? (
              <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300">
                {unreadCount} {unreadCount === 1 ? 'não lida' : 'não lidas'}
              </span>
            ) : null}
          </header>
          {top5.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ash">
              Tudo em dia. Sem novas notificações.
            </p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              {top5.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  variant="compact"
                  onMarkRead={(id) => void markRead(id)}
                  onClick={() => setOpen(false)}
                />
              ))}
            </div>
          )}
          <footer className="border-t border-white/8 bg-secondary/30 px-4 py-2 text-center">
            <Link
              href="/perfil/notificacoes"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-copper hover:underline"
            >
              Ver todas as notificações
            </Link>
          </footer>
        </div>
      ) : null}
    </div>
  );
}
