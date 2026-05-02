'use client';

import { useMemo, useState } from 'react';

import { Button } from '@devtechs/ui';

import { NotificationItem } from '@/components/notifications/notification-item';
import { useNotificationsStream } from '@/hooks/use-notifications-stream';
import type { Notification } from '@/lib/notifications-api';

type FilterMode = 'all' | 'unread' | 'type';

const PAGE_SIZE = 50;

export interface NotificationsFeedProps {
  initialNotifications: Notification[];
  initialUnreadCount: number;
  accessToken: string;
  error: string | null;
}

/**
 * Live notifications feed.
 *
 * The server component above seeded `initialNotifications` and
 * `initialUnreadCount` so the first paint already has data. This
 * component then opens the Socket.io subscription via
 * `useNotificationsStream` and prepends every `notification`
 * event onto the list.
 *
 * Filters are applied client-side (the dataset is small — backend
 * caps `pageSize` at 100). Anything beyond that is paginated via
 * a "Carregar mais" CTA — `react-virtuoso` is not installed, and
 * stale-while-revalidating 100 items into the DOM stays cheap.
 */
export function NotificationsFeed({
  initialNotifications,
  initialUnreadCount,
  accessToken,
  error,
}: NotificationsFeedProps): JSX.Element {
  const {
    notifications,
    unreadCount,
    connected,
    markRead,
    markAllRead,
    error: streamError,
  } = useNotificationsStream({
    initialNotifications,
    initialUnreadCount,
    accessToken,
  });

  const [filter, setFilter] = useState<FilterMode>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Set of distinct type prefixes for the "Por tipo" dropdown.
  const typePrefixes = useMemo(() => {
    const set = new Set<string>();
    for (const n of notifications) {
      const prefix = n.type.split('.')[0];
      if (prefix) set.add(prefix);
    }
    return [...set].sort();
  }, [notifications]);

  const filtered = useMemo(() => {
    let out = notifications;
    if (filter === 'unread') out = out.filter((n) => !n.read);
    else if (filter === 'type' && typeFilter)
      out = out.filter((n) => n.type.split('.')[0] === typeFilter);
    return out;
  }, [notifications, filter, typeFilter]);

  const sliced = filtered.slice(0, visible);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Notificações
          </h1>
          <p className="mt-1 text-sm text-ash">
            {unreadCount === 0
              ? 'Tudo em dia. Sem novas notificações.'
              : `Você tem ${unreadCount} ${
                  unreadCount === 1 ? 'notificação' : 'notificações'
                } não ${unreadCount === 1 ? 'lida' : 'lidas'}.`}{' '}
            <span
              className={`ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                connected
                  ? 'bg-emerald-500/10 text-emerald-300'
                  : 'bg-amber-500/10 text-amber-300'
              }`}
            >
              <span
                className={`h-1 w-1 rounded-full ${
                  connected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                }`}
              />
              {connected ? 'ao vivo' : 'offline'}
            </span>
          </p>
        </div>
        {unreadCount > 0 ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void markAllRead()}
          >
            Marcar todas como lidas
          </Button>
        ) : null}
      </header>

      {error ? (
        <div
          role="alert"
          className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {streamError && !error ? (
        <div
          role="status"
          className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300"
        >
          Conexão em tempo real indisponível ({streamError}). As notificações
          continuam visíveis, mas não chegarão automaticamente — recarregue a
          página de tempos em tempos.
        </div>
      ) : null}

      <div
        role="tablist"
        aria-label="Filtrar notificações"
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        <FilterTab
          active={filter === 'all'}
          onClick={() => {
            setFilter('all');
            setVisible(PAGE_SIZE);
          }}
        >
          Todas{' '}
          <span className="ml-1 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-ash">
            {notifications.length}
          </span>
        </FilterTab>
        <FilterTab
          active={filter === 'unread'}
          onClick={() => {
            setFilter('unread');
            setVisible(PAGE_SIZE);
          }}
        >
          Não lidas{' '}
          <span className="ml-1 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-ash">
            {unreadCount}
          </span>
        </FilterTab>
        <FilterTab
          active={filter === 'type'}
          onClick={() => {
            setFilter('type');
            setVisible(PAGE_SIZE);
          }}
        >
          Por tipo
        </FilterTab>
        {filter === 'type' ? (
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setVisible(PAGE_SIZE);
            }}
            className="rounded-md border border-white/8 bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Todos os tipos</option>
            {typePrefixes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {sliced.length === 0 ? (
        <EmptyState mode={filter} />
      ) : (
        <section
          className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]"
          data-testid="notifications-feed"
        >
          {sliced.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkRead={(id) => void markRead(id)}
            />
          ))}
        </section>
      )}

      {visible < filtered.length ? (
        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
          >
            Carregar mais ({filtered.length - visible} restantes)
          </Button>
        </div>
      ) : null}
    </>
  );
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'border-primary bg-copper/10 text-copper'
          : 'border-white/8 bg-secondary/40 text-ash hover:bg-accent hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ mode }: { mode: FilterMode }): JSX.Element {
  const messages: Record<FilterMode, { title: string; body: string }> = {
    all: {
      title: 'Nenhuma notificação por aqui',
      body:
        'Quando algo importante acontecer (ticket respondido, fatura próxima, atualização do sistema), você verá aqui.',
    },
    unread: {
      title: 'Tudo lido!',
      body: 'Você está em dia com as notificações.',
    },
    type: {
      title: 'Sem notificações desse tipo',
      body: 'Tente outro filtro ou volte para "Todas".',
    },
  };
  const msg = messages[mode];

  return (
    <div
      className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/8 bg-white/[0.02] px-6 py-16 text-center"
      data-testid="notifications-empty"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">{msg.title}</h2>
        <p className="mt-1 max-w-md text-sm text-ash">{msg.body}</p>
      </div>
    </div>
  );
}
