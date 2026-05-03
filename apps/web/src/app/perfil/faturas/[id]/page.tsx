import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Badge, Button } from '@szdevs/ui';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { CLIENT_NAV_ITEMS } from '@/components/app/nav-config';
import { formatBRL, formatDate } from '@/components/finance/format';
import { InvoiceStatusBadge } from '@/components/finance/InvoiceStatusBadge';
import { getInvoice, type Invoice } from '@/lib/finance-api';

import { PayButton } from './pay-button';

export const dynamic = 'force-dynamic';

export default async function FaturaDetailPage({
  params,
}: {
  params: { id: string };
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/perfil/faturas/${params.id}`);
  }
  const user = session.user;

  const res = await getInvoice(params.id);
  if (res.status === 404) notFound();
  // Backend may still 403 a regular client even for their own invoice
  // (the controller requires finance:invoices:issue). When that
  // happens we cannot reliably check ownership, so we 404 — better
  // than leaking ANY information.
  if (res.status === 403) notFound();
  if (!res.ok) {
    return (
      <AppShell
        pathname={`/perfil/faturas/${params.id}`}
        navItems={CLIENT_NAV_ITEMS}
        permissions={user.permissions}
        breadcrumbs={[
          { label: 'Minha conta', href: '/perfil' },
          { label: 'Faturas', href: '/perfil/faturas' },
          { label: 'Detalhe' },
        ]}
      >
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Não foi possível carregar esta fatura.
        </div>
      </AppShell>
    );
  }

  const invoice = res.data as Invoice;

  // Defense-in-depth: even if the backend lets the request through,
  // the page MUST hide invoices that don't belong to this user.
  // Admins (with finance:invoices:manage) skip the check.
  const isAdmin =
    user.permissions.includes('finance:invoices:manage') ||
    user.permissions.includes('finance:invoices:issue');
  if (!isAdmin && invoice.client && invoice.client.id !== user.id) {
    notFound();
  }

  const canPay = invoice.status === 'PENDING' || invoice.status === 'OVERDUE';

  return (
    <AppShell
      pathname={`/perfil/faturas/${invoice.id}`}
      navItems={CLIENT_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Minha conta', href: '/perfil' },
        { label: 'Faturas', href: '/perfil/faturas' },
        { label: invoice.number },
      ]}
    >
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.04] p-6">
        <div className="min-w-0">
          <p className="text-[11px] font-mono uppercase tracking-wider text-ash">
            Fatura {invoice.number}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {formatBRL(invoice.amount)}
          </h1>
          <p className="mt-1 text-sm text-ash">
            Vencimento em {formatDate(invoice.dueAt)} · emitida em{' '}
            {formatDate(invoice.issuedAt)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <InvoiceStatusBadge status={invoice.status} />
            {invoice.paidAt ? (
              <Badge variant="success">Paga em {formatDate(invoice.paidAt)}</Badge>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {invoice.hasPdf ? (
            <Button asChild variant="ghost" size="sm">
              <a
                href={`/perfil/faturas/${invoice.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Baixar PDF
              </a>
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="sm">
            <Link href="/perfil/faturas">← Voltar</Link>
          </Button>
        </div>
      </header>

      {canPay ? (
        <PayButton
          invoiceId={invoice.id}
          accessToken={session.accessToken}
          invoiceAmount={invoice.amount}
          invoiceNumber={invoice.number}
        />
      ) : null}

      {invoice.status === 'CANCELED' ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-300">
          <span className="mt-0.5 text-base">⚠</span>
          <div>
            <p className="font-semibold">Fatura cancelada</p>
            {invoice.cancelReason ? (
              <p className="mt-0.5 text-xs opacity-80">Motivo: {invoice.cancelReason}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {invoice.status === 'REFUNDED' ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4 text-sm text-violet-300">
          <span className="mt-0.5 text-base">↩</span>
          <div>
            <p className="font-semibold">Pagamento estornado</p>
            {invoice.cancelReason ? (
              <p className="mt-0.5 text-xs opacity-80">Motivo: {invoice.cancelReason}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr,320px]">
        {/* Items */}
        <section className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
          <header className="border-b border-white/8 px-6 py-4">
            <h2 className="text-sm font-semibold text-foreground">Itens</h2>
          </header>
          {invoice.items.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-ash">
              Esta fatura não possui itens detalhados.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-ash">
                <tr>
                  <th className="px-6 py-3 text-left">Descrição</th>
                  <th className="px-3 py-3 text-right">Qtd.</th>
                  <th className="px-3 py-3 text-right">Unitário</th>
                  <th className="px-6 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-t border-white/8">
                    <td className="px-6 py-3 text-foreground">
                      {item.description}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-ash">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-ash">
                      {formatBRL(item.unitPrice)}
                    </td>
                    <td className="px-6 py-3 text-right font-medium tabular-nums">
                      {formatBRL(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Summary */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Resumo
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ash">Subtotal</dt>
                <dd className="tabular-nums">{formatBRL(invoice.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ash">Impostos</dt>
                <dd className="tabular-nums">{formatBRL(invoice.tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-white/8 pt-2 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatBRL(invoice.amount)}</dd>
              </div>
            </dl>
          </div>

          {invoice.notes ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                Observações
              </h3>
              <p className="whitespace-pre-wrap text-sm text-ash">
                {invoice.notes}
              </p>
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Histórico
            </h3>
            <ul className="space-y-2 text-xs text-ash">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                <span>
                  Emitida em{' '}
                  <time dateTime={invoice.issuedAt} className="text-foreground">
                    {formatDate(invoice.issuedAt)}
                  </time>
                </span>
              </li>
              {invoice.paidAt ? (
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                  <span>
                    Paga em{' '}
                    <time dateTime={invoice.paidAt} className="text-foreground">
                      {formatDate(invoice.paidAt)}
                    </time>
                  </span>
                </li>
              ) : null}
              {invoice.status === 'OVERDUE' ? (
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-400" />
                  <span className="text-rose-400">
                    Vencida — aguardando pagamento
                  </span>
                </li>
              ) : null}
            </ul>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
