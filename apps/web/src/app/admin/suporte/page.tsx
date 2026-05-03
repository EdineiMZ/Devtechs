import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Badge } from '@szdevs/ui';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { SlaCountdown } from '@/components/tickets/sla-countdown';
import { TicketStatusBadge } from '@/components/tickets/ticket-status-badge';
import {
  listTickets,
  type TicketListItemDto,
  type TicketStatus,
} from '@/lib/support-api';

export const dynamic = 'force-dynamic';

const ALL_STATUSES: TicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CLIENT',
  'RESOLVED',
];

interface SearchParams {
  q?: string;
  status?: string;
}

export default async function SupportQueuePage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/suporte');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/suporte');
  if (!user.permissions.includes('support:tickets:view')) {
    redirect('/perfil');
  }

  // Single fetch with no status filter — we'll bucket client-side.
  const res = await listTickets({ pageSize: 200 });
  const all: TicketListItemDto[] = res.ok
    ? ((res.data as { items: TicketListItemDto[] }).items ?? [])
    : [];

  const q = (searchParams.q ?? '').trim().toLowerCase();
  const filtered = q
    ? all.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          String(t.number).includes(q) ||
          (t.client?.name ?? t.guestName ?? '').toLowerCase().includes(q),
      )
    : all;

  // Three queue columns. Sort within each column by SLA proximity
  // — overdue first, then closest deadline, then by createdAt.
  const sortBySla = (a: TicketListItemDto, b: TicketListItemDto): number => {
    const aSla = a.slaDeadline ? new Date(a.slaDeadline).getTime() : Infinity;
    const bSla = b.slaDeadline ? new Date(b.slaDeadline).getTime() : Infinity;
    if (aSla !== bSla) return aSla - bSla;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  };

  const unassigned = filtered
    .filter((t) => !t.assignee && ALL_STATUSES.includes(t.status))
    .sort(sortBySla);
  const mine = filtered
    .filter((t) => t.assignee?.id === user.id && ALL_STATUSES.includes(t.status))
    .sort(sortBySla);
  const inProgress = filtered
    .filter(
      (t) =>
        t.assignee &&
        t.assignee.id !== user.id &&
        ALL_STATUSES.includes(t.status),
    )
    .sort(sortBySla);

  return (
    <AppShell
      pathname="/admin/suporte"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Suporte' }]}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-copper">
            Atendimento
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            Fila de chamados
          </h1>
          <p className="mt-1 text-sm text-ash">
            {filtered.filter((t) => ALL_STATUSES.includes(t.status)).length} chamados em aberto · ordenados por SLA
          </p>
        </div>
        <form className="flex items-center gap-2">
          <input
            name="q"
            defaultValue={searchParams.q ?? ''}
            placeholder="Buscar por #número, título ou cliente"
            className="w-72 rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </form>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Column
          title="Não atribuídos"
          accent="amber"
          items={unassigned}
          emptyText="Sem chamados na fila — bom trabalho."
        />
        <Column
          title="Atribuídos a mim"
          accent="sky"
          items={mine}
          emptyText="Nenhum chamado atribuído a você."
        />
        <Column
          title="Em andamento"
          accent="emerald"
          items={inProgress}
          emptyText="Outras pessoas não estão tratando chamados agora."
        />
      </div>
    </AppShell>
  );
}

function Column({
  title,
  accent,
  items,
  emptyText,
}: {
  title: string;
  accent: 'amber' | 'sky' | 'emerald';
  items: TicketListItemDto[];
  emptyText: string;
}): JSX.Element {
  const ring = {
    amber: 'border-amber-500/30 bg-amber-500/[0.04]',
    sky: 'border-sky-500/30 bg-sky-500/[0.04]',
    emerald: 'border-emerald-500/30 bg-emerald-500/[0.04]',
  }[accent];
  const dot = {
    amber: 'bg-amber-400',
    sky: 'bg-sky-400',
    emerald: 'bg-emerald-400',
  }[accent];

  return (
    <section
      className={`flex flex-col gap-3 rounded-2xl border ${ring} p-4`}
    >
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          {title}
        </h2>
        <span className="rounded-full border border-white/8 bg-background px-2 py-0.5 text-[11px] font-medium text-ash">
          {items.length}
        </span>
      </header>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-white/8 bg-white/[0.02] p-4 text-center text-xs text-ash">
          {emptyText}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/admin/suporte/${ticket.id}`}
                className="block rounded-lg border border-white/8 bg-white/[0.02] p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-ash">
                      #{ticket.number}
                    </p>
                    <p className="truncate text-sm font-semibold leading-tight text-foreground">
                      {ticket.title}
                    </p>
                    <p className="truncate text-xs text-ash">
                      {ticket.client
                        ? (ticket.client.name ?? ticket.client.email)
                        : (ticket.guestName ?? ticket.guestEmail ?? 'Externo')}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <TicketStatusBadge status={ticket.status} />
                    {ticket.client === null && (
                      <Badge variant="secondary">EXTERNO</Badge>
                    )}
                    <Badge variant="default">{ticket.priority}</Badge>
                  </div>
                </div>
                <div className="mt-2 border-t border-white/8 pt-2">
                  <SlaCountdown dueAt={ticket.slaDeadline} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
