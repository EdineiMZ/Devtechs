import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { getFinanceServiceUrl } from '@/lib/finance-api';

export const dynamic = 'force-dynamic';

interface DreCategoryBucket {
  category: string;
  total: number;
}

interface DRESummary {
  from: string;
  to: string;
  income: { total: number; byCategory: DreCategoryBucket[] };
  expense: { total: number; byCategory: DreCategoryBucket[] };
  balance: number;
}

interface SearchParams {
  from?: string;
  to?: string;
}

async function fetchDre(token: string, from: string, to: string): Promise<DRESummary | null> {
  try {
    const res = await fetch(
      `${getFinanceServiceUrl()}/transactions/summary?from=${from}&to=${to}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    );
    if (!res.ok) return null;
    return (await res.json()) as DRESummary;
  } catch {
    return null;
  }
}

export default async function DrePage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/financeiro/dre');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/financeiro');
  if (!user.permissions.includes('finance:reports:view')) redirect('/perfil');

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const from = searchParams.from ?? defaultFrom;
  const to = searchParams.to ?? defaultTo;

  const dre = await fetchDre(session.accessToken!, from, to);
  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const dateFmt = new Intl.DateTimeFormat('pt-BR');

  const incomeItems = dre?.income?.byCategory ?? [];
  const expenseItems = dre?.expense?.byCategory ?? [];

  const categoryLabels: Record<string, string> = {
    SALARY: 'Salários',
    SERVICE: 'Serviços',
    PRODUCT: 'Produtos',
    TAX: 'Impostos',
    INFRA: 'Infraestrutura',
    MARKETING: 'Marketing',
    OTHER: 'Outros',
  };

  return (
    <AppShell
      pathname="/admin/financeiro"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Financeiro', href: '/admin/financeiro' },
        { label: 'DRE' },
      ]}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">Financeiro</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            DRE — Demonstrativo de resultado
          </h1>
        </div>
      </header>

      {/* Period selector */}
      <form className="mb-8 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-ash">De</label>
          <input
            name="from"
            type="date"
            defaultValue={from}
            className="rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ash">Até</label>
          <input
            name="to"
            type="date"
            defaultValue={to}
            className="rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-sky-600/20 px-4 py-2 text-sm font-medium text-sky-300 hover:bg-sky-600/30"
        >
          Aplicar período
        </button>
      </form>

      {dre === null ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-10 text-center text-sm text-ash">
          Não foi possível carregar os dados do DRE.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Receitas */}
          <section className="rounded-xl border border-white/8 bg-white/[0.02]">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Receitas</h2>
              <span className="text-sm font-bold text-emerald-400">{fmt.format(dre.income.total)}</span>
            </div>
            <ul className="divide-y divide-border/60">
              {incomeItems.length === 0 ? (
                <li className="px-5 py-4 text-sm text-ash">Sem receitas no período.</li>
              ) : (
                incomeItems.map((item) => (
                  <li key={item.category} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="text-ash">
                      {categoryLabels[item.category] ?? item.category}
                    </span>
                    <span className="font-medium text-emerald-400">{fmt.format(item.total)}</span>
                  </li>
                ))
              )}
            </ul>
          </section>

          {/* Despesas */}
          <section className="rounded-xl border border-white/8 bg-white/[0.02]">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Despesas</h2>
              <span className="text-sm font-bold text-red-400">{fmt.format(dre.expense.total)}</span>
            </div>
            <ul className="divide-y divide-border/60">
              {expenseItems.length === 0 ? (
                <li className="px-5 py-4 text-sm text-ash">Sem despesas no período.</li>
              ) : (
                expenseItems.map((item) => (
                  <li key={item.category} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="text-ash">
                      {categoryLabels[item.category] ?? item.category}
                    </span>
                    <span className="font-medium text-red-400">{fmt.format(item.total)}</span>
                  </li>
                ))
              )}
            </ul>
          </section>

          {/* Bottom line */}
          <section className="col-span-full rounded-xl border border-white/8 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-ash">
                  Período: {dateFmt.format(new Date(from))} → {dateFmt.format(new Date(to))}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">Resultado do período</p>
              </div>
              <p
                className={`text-2xl font-bold ${
                  dre.balance >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {fmt.format(dre.balance)}
              </p>
            </div>
            {/* Simple margin bar */}
            {dre.income.total > 0 && (
              <div className="mt-4">
                <p className="mb-1 text-xs text-ash">
                  Margem líquida: {((dre.balance / dre.income.total) * 100).toFixed(1)}%
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full transition-all ${
                      dre.balance >= 0 ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                    style={{
                      width: `${Math.min(100, Math.abs(dre.balance / dre.income.total) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
