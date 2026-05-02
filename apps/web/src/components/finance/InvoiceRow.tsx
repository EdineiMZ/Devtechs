'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@devtechs/ui';

import type { Invoice } from '@/lib/finance-api';

import { formatBRL, formatDate } from './format';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';

export interface InvoiceRowProps {
  invoice: Invoice;
  /** When false, the "Pagar" button is hidden — useful for the
   *  "Pagas" / "Canceladas" tables where pay actions don't apply. */
  showPayAction?: boolean;
  /** When true the component renders as a full card (mobile / sm).
   *  When false it renders as a `<tr>` row (desktop). */
  asCard?: boolean;
  /** Kept for API compatibility — no longer used client-side. */
  accessToken?: string;
}

/**
 * One invoice in a list. Two render modes:
 *   - `asCard=true`  → stacked card (mobile <640px)
 *   - `asCard=false` → table row (desktop ≥640px)
 *
 * Layouts share the same data and actions so a parent can pick the
 * mode without duplicating logic.
 */
export function InvoiceRow({
  invoice,
  showPayAction = true,
  asCard = false,
}: InvoiceRowProps): JSX.Element {
  const canPay =
    showPayAction &&
    (invoice.status === 'PENDING' || invoice.status === 'OVERDUE');

  const detailHref = `/perfil/faturas/${invoice.id}`;
  const pdfHref = `/perfil/faturas/${invoice.id}/pdf`;

  if (asCard) {
    return (
      <article className="space-y-3 rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-wider text-ash">
              Fatura {invoice.number}
            </p>
            <p className="truncate text-sm font-semibold text-foreground">
              {invoice.description}
            </p>
          </div>
          <InvoiceStatusBadge status={invoice.status} />
        </header>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-ash">Vencimento</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {formatDate(invoice.dueAt)}
            </dd>
          </div>
          <div>
            <dt className="text-ash">Valor</dt>
            <dd className="mt-0.5 font-bold tabular-nums text-foreground">
              {formatBRL(invoice.amount)}
            </dd>
          </div>
        </dl>
        <InvoiceActions
          invoice={invoice}
          canPay={canPay}
          detailHref={detailHref}
          pdfHref={pdfHref}
        />
      </article>
    );
  }

  return (
    <tr className="border-b border-white/8 last:border-b-0 hover:bg-secondary/20">
      <td className="px-4 py-3 font-mono text-xs text-ash">
        {invoice.number}
      </td>
      <td className="px-4 py-3">
        <span className="block truncate text-sm font-medium text-foreground">
          {invoice.description}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-ash">
        {formatDate(invoice.dueAt)}
      </td>
      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
        {formatBRL(invoice.amount)}
      </td>
      <td className="px-4 py-3">
        <InvoiceStatusBadge status={invoice.status} />
      </td>
      <td className="px-4 py-3 text-right">
        <InvoiceActions
          invoice={invoice}
          canPay={canPay}
          detailHref={detailHref}
          pdfHref={pdfHref}
          inline
        />
      </td>
    </tr>
  );
}

interface ActionsProps {
  invoice: Invoice;
  canPay: boolean;
  detailHref: string;
  pdfHref: string;
  /** When true, render a single-line `flex` of actions (table row).
   *  Otherwise stack vertically on mobile cards. */
  inline?: boolean;
}

/**
 * "Pagar" navigates to the invoice detail page where the full
 * PIX / card checkout flow lives (`pay-button.tsx`). This avoids
 * duplicating the checkout UI here and keeps the list lightweight.
 */
function InvoiceActions({
  invoice,
  canPay,
  detailHref,
  pdfHref,
  inline = false,
}: ActionsProps): JSX.Element {
  const router = useRouter();

  return (
    <div
      className={
        inline
          ? 'flex items-center justify-end gap-1.5'
          : 'flex flex-col gap-1.5'
      }
    >
      {canPay ? (
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={() => router.push(detailHref)}
        >
          Pagar
        </Button>
      ) : null}
      {invoice.hasPdf ? (
        <Button asChild size="sm" variant="ghost">
          <a href={pdfHref} target="_blank" rel="noopener noreferrer">
            PDF
          </a>
        </Button>
      ) : null}
      <Button asChild size="sm" variant="ghost">
        <Link href={detailHref}>Detalhes</Link>
      </Button>
    </div>
  );
}
