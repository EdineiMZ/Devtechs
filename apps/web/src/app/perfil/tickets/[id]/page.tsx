import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Badge, Button } from '@devtechs/ui';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { CLIENT_NAV_ITEMS } from '@/components/app/nav-config';
import { SlaCountdown } from '@/components/tickets/sla-countdown';
import { TicketStatusBadge } from '@/components/tickets/ticket-status-badge';
import { getTicket, type TicketDetailDto } from '@/lib/support-api';

import { TicketChat } from './ticket-chat';

export const dynamic = 'force-dynamic';

export default async function TicketDetailPage({
  params,
}: {
  params: { id: string };
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/perfil/tickets/${params.id}`);
  }
  const user = session.user;

  const res = await getTicket(params.id);
  if (res.status === 404) notFound();
  if (res.status === 403) {
    // The backend already filters by ownership for non-agents — we
    // mirror the response here so the redirect makes sense.
    redirect('/perfil/tickets');
  }
  if (!res.ok) {
    return (
      <AppShell
        pathname={`/perfil/tickets/${params.id}`}
        navItems={CLIENT_NAV_ITEMS}
        permissions={user.permissions}
        breadcrumbs={[
          { label: 'Minha conta', href: '/perfil' },
          { label: 'Chamados', href: '/perfil/tickets' },
          { label: 'Detalhe' },
        ]}
      >
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Não foi possível carregar o chamado.
        </div>
      </AppShell>
    );
  }

  const ticket = res.data as TicketDetailDto;
  const isAgent = user.permissions.includes('support:tickets:close');
  const resolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

  return (
    <AppShell
      pathname={`/perfil/tickets/${ticket.id}`}
      navItems={CLIENT_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Minha conta', href: '/perfil' },
        { label: 'Chamados', href: '/perfil/tickets' },
        { label: `#${ticket.number}` },
      ]}
    >
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.04] p-6">
        <div className="min-w-0">
          <p className="text-[11px] font-mono uppercase tracking-wider text-ash">
            #{ticket.number} ·{' '}
            <span className="text-copper">{ticket.category}</span>
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {ticket.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ash">
            {ticket.description}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TicketStatusBadge status={ticket.status} />
            <Badge variant="default">{ticket.priority}</Badge>
            <SlaCountdown dueAt={ticket.slaDeadline} resolved={resolved} />
            {ticket.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/8 bg-background px-2 py-0.5 text-[11px] text-ash"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/perfil/tickets">← Voltar</Link>
          </Button>
        </div>
      </header>

      <TicketChat
        ticketId={ticket.id}
        accessToken={session.accessToken}
        currentUserId={user.id}
        isAgent={isAgent}
        ticketStatus={ticket.status}
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
        }))}
      />
    </AppShell>
  );
}
