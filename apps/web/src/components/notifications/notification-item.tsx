'use client';

import Link from 'next/link';

import type { Notification } from '@/lib/notifications-api';

/**
 * One notification card. Two layouts:
 *   - `compact` (used inside the bell dropdown): two-line preview
 *   - `default` (used on /perfil/notificacoes): full body + actions
 *
 * Title is bold when unread; muted when read. The icon is picked
 * from the type prefix so a "ticket.replied" event gets the same
 * icon as "ticket.opened" without per-event configuration.
 */
export interface NotificationItemProps {
  notification: Notification;
  onMarkRead?: (id: string) => void;
  onClick?: (notification: Notification) => void;
  variant?: 'default' | 'compact';
}

const TYPE_ICONS: Record<string, JSX.Element> = {
  ticket: (
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  ),
  invoice: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </>
  ),
  payment: (
    <>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>
  ),
  rh: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </>
  ),
  vacation: (
    <>
      <path d="M12 2v4M4 4l2.83 2.83M2 12h4M4 20l2.83-2.83M12 22v-4M20 20l-2.83-2.83M22 12h-4M20 4l-2.83 2.83" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  contact: (
    <>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </>
  ),
  default: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
};

const TYPE_TONE: Record<string, { bg: string; ring: string; text: string }> = {
  ticket: {
    bg: 'bg-sky-500/15',
    ring: 'ring-sky-500/30',
    text: 'text-sky-300',
  },
  invoice: {
    bg: 'bg-emerald-500/15',
    ring: 'ring-emerald-500/30',
    text: 'text-emerald-300',
  },
  payment: {
    bg: 'bg-emerald-500/15',
    ring: 'ring-emerald-500/30',
    text: 'text-emerald-300',
  },
  rh: {
    bg: 'bg-violet-500/15',
    ring: 'ring-violet-500/30',
    text: 'text-violet-300',
  },
  vacation: {
    bg: 'bg-amber-500/15',
    ring: 'ring-amber-500/30',
    text: 'text-amber-300',
  },
  contact: {
    bg: 'bg-fuchsia-500/15',
    ring: 'ring-fuchsia-500/30',
    text: 'text-fuchsia-300',
  },
  default: {
    bg: 'bg-secondary',
    ring: 'ring-white/8',
    text: 'text-ash',
  },
};

function pickKey(type: string): string {
  const prefix = type.split('.')[0]?.toLowerCase() ?? 'default';
  if (prefix in TYPE_ICONS) return prefix;
  return 'default';
}

function relative(iso: string): string {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return '';
  const diffSec = Math.floor((target - Date.now()) / 1000);
  const absSec = Math.abs(diffSec);

  if (absSec > 7 * 24 * 3600) {
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  if (absSec < 60) return rtf.format(diffSec, 'second');
  if (absSec < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (absSec < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86400), 'day');
}

export function NotificationItem({
  notification,
  onMarkRead,
  onClick,
  variant = 'default',
}: NotificationItemProps): JSX.Element {
  const key = pickKey(notification.type);
  const tone = TYPE_TONE[key]!;
  const compact = variant === 'compact';

  const inner = (
    <article
      className={`flex gap-3 ${compact ? 'p-3' : 'p-4'} ${
        notification.read ? 'opacity-70' : ''
      }`}
      data-testid="notification-item"
      data-read={notification.read ? 'true' : 'false'}
    >
      <span
        className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ring-1 ${tone.bg} ${tone.ring} ${tone.text}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          {TYPE_ICONS[key]}
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h3
            className={`truncate text-sm ${
              notification.read
                ? 'font-medium text-ash'
                : 'font-semibold text-foreground'
            }`}
          >
            {notification.title}
          </h3>
          {!notification.read ? (
            <span
              aria-label="Não lida"
              className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-400"
            />
          ) : null}
        </div>
        <p
          className={`mt-1 text-sm text-ash ${
            compact ? 'line-clamp-2' : ''
          }`}
        >
          {notification.body}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <time
            dateTime={notification.createdAt}
            className="text-[11px] text-ash"
          >
            {relative(notification.createdAt)}
          </time>
          {!compact ? (
            <div className="flex items-center gap-3 text-xs">
              {!notification.read && onMarkRead ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onMarkRead(notification.id);
                  }}
                  className="font-medium text-copper hover:underline"
                >
                  Marcar como lida
                </button>
              ) : null}
              {notification.link ? (
                <Link
                  href={notification.link}
                  className="font-medium text-copper hover:underline"
                >
                  Ver detalhes →
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );

  // The compact variant inside the dropdown becomes a clickable
  // surface itself — full-width hit area for fast triage.
  if (compact) {
    const handleClick = () => {
      if (onMarkRead && !notification.read) onMarkRead(notification.id);
      if (onClick) onClick(notification);
    };
    if (notification.link) {
      return (
        <Link
          href={notification.link}
          onClick={handleClick}
          className="block border-b border-white/8 last:border-b-0 hover:bg-secondary/40"
        >
          {inner}
        </Link>
      );
    }
    return (
      <button
        type="button"
        onClick={handleClick}
        className="block w-full border-b border-white/8 text-left last:border-b-0 hover:bg-secondary/40"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="border-b border-white/8 last:border-b-0 hover:bg-secondary/20">
      {inner}
    </div>
  );
}
