import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { CLIENT_NAV_ITEMS } from '@/components/app/nav-config';
import { formatBRL } from '@/components/finance/format';
import { InvoiceRow } from '@/components/finance/InvoiceRow';
import { listInvoices, type Invoice } from '@/lib/finance-api';

export const dynamic = 'force-dynamic';

export default async function FaturasPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/perfil/faturas');
  const user = session.user;

  const res = await listInvoices({ clientId: user.id });

  let invoices: Invoice[] = [];
  let error: string | null = null;
  if (res.ok) {
    invoices = res.data as Invoice[];
  } else if (res.status === 403) {
    // Unexpected: backend now allows clients to list their own invoices.
    // Treat as empty rather than a hard error as a safety fallback.
    invoices = [];
  } else {
    error =
      'Não conseguimos carregar suas faturas no momento. Tente novamente em instantes.';
  }

  // Group by display state. PENDING + OVERDUE land in "Em aberto".
  const open = invoices.filter(
    (i) => i.status === 'PENDING' || i.status === 'OVERDUE',
  );
  const paid = invoices.filter((i) => i.status === 'PAID');
  const canceled = invoices.filter(
    (i) => i.status === 'CANCELED' || i.status === 'REFUNDED',
  );

  const overdueCount = invoices.filter((i) => i.status === 'OVERDUE').length;
  const openTotal = open.reduce((sum, i) => sum + i.amount, 0);

  return (
    <AppShell
      pathname="/perfil/faturas"
      navItems={CLIENT_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Minha conta', href: '/perfil' },
        { label: 'Faturas' },
      ]}
    >
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Faturas
        </h1>
        <p className="mt-1 text-sm text-ash">
          {open.length === 0
            ? 'Você não tem faturas em aberto no momento.'
            : `Você tem ${open.length} ${
                open.length === 1 ? 'fatura' : 'faturas'
              } em aberto totalizando ${formatBRL(openTotal)}.`}
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {overdueCount > 0 ? (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-md border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300"
        >
          <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-xs">
            !
          </span>
          <div>
            <p className="font-semibold">
              {overdueCount === 1
                ? 'Você tem 1 fatura vencida'
                : `Você tem ${overdueCount} faturas vencidas`}
            </p>
            <p className="mt-1 opacity-90">
              Para evitar suspensão do serviço, regularize o pagamento o quanto
              antes.
            </p>
          </div>
        </div>
      ) : null}

      {invoices.length === 0 && !error ? (
        <EmptyState />
      ) : (
        <>
          <InvoiceGroup
            title="Em aberto"
            invoices={open}
            accessToken={session.accessToken}
            highlight
            showPayAction
          />
          <InvoiceGroup
            title="Pagas"
            invoices={paid}
            accessToken={session.accessToken}
          />
          <InvoiceGroup
            title="Canceladas / Estornadas"
            invoices={canceled}
            accessToken={session.accessToken}
          />
        </>
      )}
    </AppShell>
  );
}

function InvoiceGroup({
  title,
  invoices,
  accessToken,
  highlight,
  showPayAction,
}: {
  title: string;
  invoices: Invoice[];
  accessToken: string;
  highlight?: boolean;
  showPayAction?: boolean;
}): JSX.Element | null {
  if (invoices.length === 0) return null;
  return (
    <section className="mb-8">
      <header className="mb-3 flex items-center justify-between">
        <h2
          className={`text-sm font-semibold uppercase tracking-wider ${
            highlight ? 'text-foreground' : 'text-ash'
          }`}
        >
          {title}
        </h2>
        <span className="rounded-full border border-white/8 bg-background px-2 py-0.5 text-[11px] text-ash">
          {invoices.length}
        </span>
      </header>

      {/* Mobile: cards */}
      <div className="grid gap-3 sm:hidden">
        {invoices.map((invoice) => (
          <InvoiceRow
            key={invoice.id}
            invoice={invoice}
            accessToken={accessToken}
            asCard
            showPayAction={showPayAction}
          />
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] sm:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-ash">
            <tr>
              <th className="px-4 py-3 text-left">Número</th>
              <th className="px-4 py-3 text-left">Descrição</th>
              <th className="px-4 py-3 text-left">Vencimento</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <InvoiceRow
                key={invoice.id}
                invoice={invoice}
                accessToken={accessToken}
                showPayAction={showPayAction}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmptyState(): JSX.Element {
  return (
    <div
      className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/8 bg-white/[0.02] px-6 py-16 text-center"
      data-testid="faturas-empty"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
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
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Você ainda não tem faturas
        </h2>
        <p className="mt-1 max-w-md text-sm text-ash">
          Quando contratarmos um plano, suas faturas aparecem aqui — incluindo
          NF-e, comprovantes e histórico de pagamentos.
        </p>
      </div>
      <Link
        href="/perfil"
        className="text-sm text-copper underline-offset-4 hover:underline"
      >
        Voltar ao painel
      </Link>
    </div>
  );
}
