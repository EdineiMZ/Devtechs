'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

import {
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  type TicketCategory,
  type TicketStatus,
} from '@/lib/support-api';

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  WAITING_CLIENT: 'Aguardando cliente',
  RESOLVED: 'Resolvido',
  CLOSED: 'Encerrado',
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  BUG: 'Bug',
  FEATURE: 'Feature',
  QUESTION: 'Dúvida',
  BILLING: 'Financeiro',
  OTHER: 'Outros',
};

/**
 * Search + status + category filters that round-trip through the URL
 * `searchParams`. The page re-runs as a server component when the
 * query string changes, so `listTickets()` picks up the new filter
 * without a manual fetch on the client.
 */
export function TicketFilters(): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialQ = searchParams.get('q') ?? '';
  const initialStatus = searchParams.get('status') ?? '';
  const initialCategory = searchParams.get('category') ?? '';

  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);
  const [category, setCategory] = useState(initialCategory);
  const [, startTransition] = useTransition();

  const apply = useCallback(
    (next: { q?: string; status?: string; category?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      const setOrDelete = (key: string, value: string | undefined) => {
        if (value && value.length > 0) params.set(key, value);
        else params.delete(key);
      };
      setOrDelete('q', next.q ?? q);
      setOrDelete('status', next.status ?? status);
      setOrDelete('category', next.category ?? category);
      const search = params.toString();
      startTransition(() => {
        router.replace(search ? `${pathname}?${search}` : pathname);
      });
    },
    [searchParams, q, status, category, router, pathname],
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs font-medium text-ash">
          Buscar
        </span>
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
          }}
          onBlur={() => apply({ q })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              apply({ q });
            }
          }}
          placeholder="Título ou número do chamado"
          className="rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </label>

      <label className="flex flex-col gap-1 sm:w-48">
        <span className="text-xs font-medium text-ash">
          Status
        </span>
        <select
          value={status}
          onChange={(e) => {
            const v = e.target.value;
            setStatus(v);
            apply({ status: v });
          }}
          className="rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Todos os status</option>
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 sm:w-48">
        <span className="text-xs font-medium text-ash">
          Categoria
        </span>
        <select
          value={category}
          onChange={(e) => {
            const v = e.target.value;
            setCategory(v);
            apply({ category: v });
          }}
          className="rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Todas as categorias</option>
          {TICKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </label>

      {(q || status || category) && (
        <button
          type="button"
          onClick={() => {
            setQ('');
            setStatus('');
            setCategory('');
            apply({ q: '', status: '', category: '' });
          }}
          className="rounded-md border border-white/8 bg-background px-3 py-2 text-xs text-ash hover:bg-secondary"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
