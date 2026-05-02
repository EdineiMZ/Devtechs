import { Badge } from '@devtechs/ui';

import type { TicketStatus } from '@/lib/support-api';

const STATUS_CONFIG: Record<
  TicketStatus,
  {
    label: string;
    variant:
      | 'default'
      | 'secondary'
      | 'outline'
      | 'success'
      | 'warning'
      | 'destructive';
  }
> = {
  OPEN: { label: 'Aberto', variant: 'default' },
  IN_PROGRESS: { label: 'Em andamento', variant: 'secondary' },
  WAITING_CLIENT: { label: 'Aguardando cliente', variant: 'warning' },
  RESOLVED: { label: 'Resolvido', variant: 'success' },
  CLOSED: { label: 'Encerrado', variant: 'outline' },
};

/**
 * Visually consistent status badge for tickets. Backend uses
 * `WAITING_CLIENT` (the spec mentioned `WAITING_CUSTOMER`, but the
 * Prisma enum and DTO ship the former — we follow the wire format).
 */
export function TicketStatusBadge({
  status,
}: {
  status: TicketStatus | string;
}): JSX.Element {
  const config = STATUS_CONFIG[status as TicketStatus] ?? {
    label: status,
    variant: 'default' as const,
  };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
