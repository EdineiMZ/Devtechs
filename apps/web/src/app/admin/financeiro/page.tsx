import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { getFinanceServiceUrl } from '@/lib/finance-api';

import { CashflowChart } from './_components/cashflow-chart';

export const dynamic = 'force-dynamic';

interface TransactionSummary {
  income: { total: number; byCategory: Array<{ category: string; total: number }> } | number;
  expense: { total: number; byCategory: Array<{ category: string; total: number }> } | number;
  balance: number;
  from?: string;
  to?: string;
  period?: { from: string; to: string };
}

interface CashflowPoint {
  month: string;
  income: number;
  expense: number;
}

async function fetchSummary(token: string): Promise<TransactionSummary | null> {
  try {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const res = await fetch(
      `${getFinanceServiceUrl()}/transactions/summary?from=${from}&to=${to}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as TransactionSummary;
  } catch {
    return null;
  }
}

async function fetchCashflow(token: string): Promise<CashflowPoint[]> {
  try {
    const res = await fetch(
      `${getFinanceServiceUrl()}/transactions/cashflow?months=6`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as CashflowPoint[]) : [];
  } catch {
    return [];
  }
}

export default async function FinanceiroDashboardPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/financeiro');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/financeiro');
  if (!user.permissions.includes('finance:reports:view')) redirect('/perfil');

  const token = session.accessToken!;
  const [summary, cashflow] = await Promise.all([
    fetchSummary(token),
    fetchCashflow(token),
  ]);

  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const incomeTotal = summary
    ? typeof summary.income === 'number'
      ? summary.income
      : summary.income.total
    : null;
  const expenseTotal = summary
    ? typeof summary.expense === 'number'
      ? summary.expense
      : summary.expense.total
    : null;

  const kpis = [
    {
      label: 'Receitas do mês',
      value: incomeTotal !== null ? fmt.format(incomeTotal) : '—',
      color: 'emerald',
    },
    {
      label: 'Despesas do mês',
      value: expenseTotal !== null ? fmt.format(expenseTotal) : '—',
      color: 'red',
    },
    {
      label: 'Saldo líquido',
      value: summary ? fmt.format(summary.balance) : '—',
      color: summary && summary.balance >= 0 ? 'sky' : 'red',
    },
  ];

  return (
    <AppShell
      pathname="/admin/financeiro"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Financeiro' }]}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">
            Financeiro
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            Painel financeiro
          </h1>
          <p className="mt-1 text-sm text-ash">
            DRE simplificado e fluxo de caixa
          </p>
        </div>
        {user.permissions.includes('finance:accounts:edit') && (
          <Link
            href="/admin/financeiro/transacoes/nova"
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
          >
            + Lançamento
          </Link>
        )}
      </header>

      {/* KPI cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-white/8 bg-white/[0.02] p-5"
          >
            <p className="text-xs text-ash">{k.label}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Cashflow chart */}
      {cashflow.length > 0 && (
        <section className="mb-8 rounded-xl border border-white/8 bg-white/[0.02] p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Fluxo de caixa — últimos 6 meses
          </h2>
          <CashflowChart data={cashflow} />
        </section>
      )}

      {/* Quick navigation */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/admin/financeiro/transacoes', label: 'Transações', desc: 'Receitas e despesas' },
          { href: '/admin/financeiro/faturas', label: 'Faturas', desc: 'Notas e pagamentos' },
          { href: '/admin/financeiro/dre', label: 'DRE', desc: 'Demonstrativo de resultado' },
          { href: '/admin/financeiro/condicoes', label: 'Condições de Pagamento', desc: 'Parcelamentos e juros' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col gap-1 rounded-xl border border-white/8 bg-white/[0.02] p-5 transition-all hover:-translate-y-0.5 hover:border-sky-500/30 hover:shadow-md"
          >
            <p className="font-semibold text-foreground">{item.label}</p>
            <p className="text-xs text-ash">{item.desc}</p>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
