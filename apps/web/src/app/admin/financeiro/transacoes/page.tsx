import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { getFinanceServiceUrl } from '@/lib/finance-api';

export const dynamic = 'force-dynamic';

interface Transaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  description: string;
  amount: number;
  date: string;
  status: string;
}

interface PaginatedTransactions {
  items: Transaction[];
  total: number;
  page: number;
  totalPages: number;
}

interface SearchParams {
  type?: string;
  category?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: string;
}

async function fetchTransactions(
  token: string,
  filters: SearchParams,
): Promise<PaginatedTransactions> {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.category) params.set('category', filters.category);
  if (filters.status) params.set('status', filters.status);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  params.set('page', filters.page ?? '1');
  params.set('pageSize', '20');

  try {
    const res = await fetch(
      `${getFinanceServiceUrl()}/transactions?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    );
    if (!res.ok) return { items: [], total: 0, page: 1, totalPages: 1 };
    return (await res.json()) as PaginatedTransactions;
  } catch {
    return { items: [], total: 0, page: 1, totalPages: 1 };
  }
}

export default async function TransacoesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/financeiro/transacoes');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/financeiro');
  if (!user.permissions.includes('finance:reports:view')) redirect('/perfil');

  const data = await fetchTransactions(session.accessToken!, searchParams);
  const canCreate = user.permissions.includes('finance:accounts:edit');

  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const dateFmt = new Intl.DateTimeFormat('pt-BR');

  return (
    <AppShell
      pathname="/admin/financeiro"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Financeiro', href: '/admin/financeiro' },
        { label: 'Transações' },
      ]}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">Financeiro</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Transações</h1>
          <p className="mt-1 text-sm text-ash">{data.total} registros</p>
        </div>
        {canCreate && (
          <Link
            href="/admin/financeiro/transacoes/nova"
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
          >
            + Lançar
          </Link>
        )}
      </header>

      {/* Filters */}
      <form className="mb-6 flex flex-wrap gap-3">
        <select
          name="type"
          defaultValue={searchParams.type ?? ''}
          className="rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
        >
          <option value="">Todos os tipos</option>
          <option value="INCOME">Receita</option>
          <option value="EXPENSE">Despesa</option>
        </select>
        <select
          name="category"
          defaultValue={searchParams.category ?? ''}
          className="rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
        >
          <option value="">Todas categorias</option>
          <option value="SALARY">Salário</option>
          <option value="SERVICE">Serviço</option>
          <option value="PRODUCT">Produto</option>
          <option value="TAX">Imposto</option>
          <option value="INFRA">Infraestrutura</option>
          <option value="MARKETING">Marketing</option>
          <option value="OTHER">Outro</option>
        </select>
        <input
          name="from"
          type="date"
          defaultValue={searchParams.from ?? ''}
          className="rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
        />
        <input
          name="to"
          type="date"
          defaultValue={searchParams.to ?? ''}
          className="rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-sky-600/20 px-4 py-2 text-sm font-medium text-sky-300 hover:bg-sky-600/30"
        >
          Filtrar
        </button>
      </form>

      <div className="rounded-xl border border-white/8 bg-white/[0.02]">
        {data.items.length === 0 ? (
          <p className="p-10 text-center text-sm text-ash">
            Nenhuma transação encontrada.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-ash">
                  <th className="px-4 py-3 text-left font-medium">Descrição</th>
                  <th className="px-4 py-3 text-left font-medium">Categoria</th>
                  <th className="px-4 py-3 text-left font-medium">Data</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.items.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{t.description}</p>
                    </td>
                    <td className="px-4 py-3 text-ash">{t.category}</td>
                    <td className="px-4 py-3 text-ash">
                      {dateFmt.format(new Date(t.date))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          t.status === 'PAID'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : t.status === 'OVERDUE'
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        {t.status === 'PAID' ? 'Pago' : t.status === 'OVERDUE' ? 'Vencido' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          t.type === 'INCOME' ? 'font-semibold text-emerald-400' : 'font-semibold text-red-400'
                        }
                      >
                        {t.type === 'EXPENSE' ? '−' : '+'}
                        {fmt.format(t.amount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
