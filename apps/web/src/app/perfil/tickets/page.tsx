import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { Button } from '@devtechs/ui';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { CLIENT_NAV_ITEMS } from '@/components/app/nav-config';
import { TicketCard } from '@/components/tickets/ticket-card';
import { TicketFilters } from '@/components/tickets/ticket-filters';
import {
  listTickets,
  type TicketCategory,
  type TicketListItemDto,
  type TicketStatus,
} from '@/lib/support-api';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
  category?: string;
  q?: string;
}

export default async function MyTicketsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) {
    redirect('/login?callbackUrl=/perfil/tickets');
  }
  const user = session.user;

  const status = isStatus(searchParams.status) ? searchParams.status : undefined;
  const category = isCategory(searchParams.category)
    ? searchParams.category
    : undefined;

  const res = await listTickets({
    clientId: user.id,
    status,
    category,
    pageSize: 100,
  });

  let tickets: TicketListItemDto[] = [];
  let error: string | null = null;
  if (res.ok) {
    tickets = (res.data as { items: TicketListItemDto[] }).items ?? [];
  } else {
    error = humanError(res);
  }

  // Client-side `q` filter — title or number contains the query.
  const q = (searchParams.q ?? '').trim().toLowerCase();
  const filtered = q
    ? tickets.filter(
        (t) =>
          t.title.toLowerCase().includes(q) || String(t.number).includes(q),
      )
    : tickets;

  return (
    <AppShell
      pathname="/perfil/tickets"
      navItems={CLIENT_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Minha conta', href: '/perfil' },
        { label: 'Meus chamados' },
      ]}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Meus chamados
          </h1>
          <p className="mt-1 text-sm text-ash">
            Acompanhe os chamados que você abriu — respostas chegam em tempo
            real.
          </p>
        </div>
        <Button asChild size="md" variant="primary">
          <Link href="/perfil/tickets/novo">+ Novo chamado</Link>
        </Button>
      </header>

      <Suspense
        fallback={
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-sm text-ash">
            Carregando filtros…
          </div>
        }
      >
        <TicketFilters />
      </Suspense>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="font-semibold">Não foi possível carregar os chamados.</p>
          <p className="mt-1 opacity-90">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            tickets.length === 0
              ? 'Você ainda não abriu nenhum chamado'
              : 'Nenhum chamado bate com esses filtros'
          }
          description={
            tickets.length === 0
              ? 'Quando precisar de ajuda, abra um chamado e nossa equipe responde em até 24h úteis.'
              : 'Ajuste os filtros ou limpe a busca para ver todos.'
          }
          action={
            tickets.length === 0 ? (
              <Button asChild variant="primary">
                <Link href="/perfil/tickets/novo">Abrir primeiro chamado</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </section>
      )}
    </AppShell>
  );
}

function isStatus(value: string | undefined): value is TicketStatus {
  return (
    value === 'OPEN' ||
    value === 'IN_PROGRESS' ||
    value === 'WAITING_CLIENT' ||
    value === 'RESOLVED' ||
    value === 'CLOSED'
  );
}

function isCategory(value: string | undefined): value is TicketCategory {
  return (
    value === 'BUG' ||
    value === 'FEATURE' ||
    value === 'QUESTION' ||
    value === 'BILLING' ||
    value === 'OTHER'
  );
}

function humanError(res: { status: number; data: unknown }): string {
  if (res.status === 401) return 'Faça login novamente para continuar.';
  if (res.status === 403) return 'Você não tem permissão para ver chamados.';
  if (res.status >= 500) return 'O serviço de suporte está indisponível.';
  const m = (res.data as { message?: string | string[] } | null)?.message;
  if (Array.isArray(m)) return m.join(', ');
  return m ?? 'Erro desconhecido.';
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: JSX.Element | null;
}): JSX.Element {
  return (
    <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/8 bg-white/[0.02] px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-copper/10 text-copper">
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
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-1 max-w-md text-sm text-ash">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
