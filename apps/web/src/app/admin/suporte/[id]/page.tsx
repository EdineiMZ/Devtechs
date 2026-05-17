import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Badge, Button } from '@szdevs/ui';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { SlaCountdown } from '@/components/tickets/sla-countdown';
import { TicketStatusBadge } from '@/components/tickets/ticket-status-badge';
import { getTicket, type TicketDetailDto } from '@/lib/support-api';

import { TicketChat } from '@/app/perfil/tickets/[id]/ticket-chat';

import { AgentActions } from './agent-actions';

export const dynamic = 'force-dynamic';

export default async function AgentTicketDetail({
  params,
}: {
  params: { id: string };
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/admin/suporte/${params.id}`);
  }
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/suporte');
  if (!user.permissions.includes('support:tickets:view')) {
    redirect('/perfil');
  }
  const isAgent = user.permissions.includes('support:tickets:close');

  const res = await getTicket(params.id);
  if (res.status === 404) notFound();
  if (!res.ok) {
    return (
      <AppShell
        pathname={`/admin/suporte/${params.id}`}
        navItems={ADMIN_NAV_ITEMS}
        permissions={user.permissions}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Suporte', href: '/admin/suporte' },
          { label: 'Detalhe' },
        ]}
      >
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Não foi possível carregar este chamado.
        </div>
      </AppShell>
    );
  }
  const ticket = res.data as TicketDetailDto;
  const resolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

  return (
    <AppShell
      pathname={`/admin/suporte/${ticket.id}`}
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Suporte', href: '/admin/suporte' },
        { label: `#${ticket.number}` },
      ]}
    >
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.04] p-6">
        <div className="min-w-0">
          <p className="text-[11px] font-mono uppercase tracking-wider text-ash">
            #{ticket.number} · {ticket.category} · cliente{' '}
            <span className="text-foreground">
              {ticket.client
                ? (ticket.client.name ?? ticket.client.email)
                : (ticket.guestName ?? ticket.guestEmail ?? 'Externo')}
            </span>
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {ticket.title}
          </h1>
          <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm text-ash">
            {ticket.description}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TicketStatusBadge status={ticket.status} />
            <Badge variant="default">{ticket.priority}</Badge>
            <SlaCountdown dueAt={ticket.slaDeadline} resolved={resolved} />
          </div>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/suporte">← Voltar à fila</Link>
        </Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
        <TicketChat
          ticketId={ticket.id}
          accessToken={session.accessToken}
          currentUserId={user.id}
          isAgent={isAgent}
          ticketStatus={ticket.status}
          initialTicketAttachments={ticket.attachments}
          initialMessages={ticket.messages.map((m) => ({
            id: m.id,
            ticketId: ticket.id,
            body: m.body,
            isInternal: m.isInternal,
            author: {
              id: m.author.id,
              name: m.author.name ?? m.author.email,
              email: m.author.email,
            },
            createdAt: m.createdAt,
            attachments: m.attachments,
          }))}
        />

        <aside className="flex flex-col gap-4">
          <AgentActions
            ticketId={ticket.id}
            currentStatus={ticket.status}
            assignee={ticket.assignee}
            currentUserId={user.id}
            accessToken={session.accessToken}
          />

          <div className="rounded-xl border border-white/8 bg-white/[0.04] p-4 text-xs">
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              Detalhes
            </h3>
            <dl className="space-y-1.5 text-ash">
              <div className="flex justify-between gap-2">
                <dt>Aberto</dt>
                <dd className="text-foreground">
                  {new Date(ticket.createdAt).toLocaleString('pt-BR')}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Última atividade</dt>
                <dd className="text-foreground">
                  {new Date(ticket.updatedAt).toLocaleString('pt-BR')}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Primeira resposta</dt>
                <dd className="text-foreground">
                  {ticket.firstResponseAt
                    ? new Date(ticket.firstResponseAt).toLocaleString('pt-BR')
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Resolvido</dt>
                <dd className="text-foreground">
                  {ticket.resolvedAt
                    ? new Date(ticket.resolvedAt).toLocaleString('pt-BR')
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Mensagens</dt>
                <dd className="text-foreground">{ticket.messages.length}</dd>
              </div>
              {ticket.tags.length > 0 ? (
                <div className="pt-2">
                  <dt className="mb-1">Tags</dt>
                  <dd className="flex flex-wrap gap-1">
                    {ticket.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/8 bg-background px-2 py-0.5 text-[10px] text-ash"
                      >
                        #{tag}
                      </span>
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
