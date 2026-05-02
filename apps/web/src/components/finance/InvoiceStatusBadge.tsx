import { Badge } from '@devtechs/ui';

import type { UiInvoiceStatus } from '@/lib/finance-api';

const STATUS_CONFIG: Record<
  UiInvoiceStatus,
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
  PAID: { label: 'Paga', variant: 'success' },
  PENDING: { label: 'Em aberto', variant: 'warning' },
  OVERDUE: { label: 'Vencida', variant: 'destructive' },
  CANCELED: { label: 'Cancelada', variant: 'outline' },
  REFUNDED: { label: 'Estornada', variant: 'secondary' },
};

/** Colored status badge for invoices.
 *
 * - PAID    → verde (`success`)
 * - PENDING → âmbar (`warning`)
 * - OVERDUE → vermelho (`destructive`)
 * - CANCELED → cinza (`outline`)
 *
 * Falls back to a neutral badge for unknown values so we never crash
 * a page just because the backend introduced a new status literal.
 */
export function InvoiceStatusBadge({
  status,
}: {
  status: UiInvoiceStatus | string;
}): JSX.Element {
  const config = STATUS_CONFIG[status as UiInvoiceStatus] ?? {
    label: status,
    variant: 'default' as const,
  };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
