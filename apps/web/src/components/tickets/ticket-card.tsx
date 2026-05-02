import Link from 'next/link';

import { Card } from '@devtechs/ui';

import type { TicketListItemDto } from '@/lib/support-api';

import { SlaCountdown } from './sla-countdown';
import { TicketStatusBadge } from './ticket-status-badge';

const PRIORITY_TONE: Record<string, string> = {
  LOW: 'text-slate-400',
  MEDIUM: 'text-sky-400',
  HIGH: 'text-amber-400',
  CRITICAL: 'text-rose-400',
};

export function TicketCard({
  ticket,
  href,
}: {
  ticket: TicketListItemDto;
  /** Override link target — defaults to `/perfil/tickets/[id]`. */
  href?: string;
}): JSX.Element {
  const target = href ?? `/perfil/tickets/${ticket.id}`;
  const lastUpdate = new Date(ticket.updatedAt);
  const lastUpdateLabel = lastUpdate.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const resolved =
    ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

  return (
    <Link
      href={target}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Card className="flex h-full flex-col gap-3 border-white/8 bg-white/[0.05] p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-copper/40 group-hover:shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-wider text-ash">
              #{ticket.number}
            </p>
            <h3 className="mt-0.5 truncate text-base font-semibold leading-tight text-foreground">
              {ticket.title}
            </h3>
          </div>
          <TicketStatusBadge status={ticket.status} />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span
            className={`font-medium uppercase tracking-wider ${
              PRIORITY_TONE[ticket.priority] ?? 'text-ash'
            }`}
          >
            {ticket.priority}
          </span>
          <span className="text-ash">·</span>
          <span className="text-ash">{ticket.category}</span>
          <span className="text-ash">·</span>
          <span className="text-ash">
            {ticket.messageCount}{' '}
            {ticket.messageCount === 1 ? 'mensagem' : 'mensagens'}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-3 text-xs">
          <span className="text-ash">
            Atualizado em{' '}
            <time dateTime={ticket.updatedAt}>{lastUpdateLabel}</time>
          </span>
          <SlaCountdown dueAt={ticket.slaDeadline} resolved={resolved} />
        </div>
      </Card>
    </Link>
  );
}
