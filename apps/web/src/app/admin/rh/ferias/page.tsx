import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listVacations } from '@/lib/rh-api';
import type { PaginatedVacations, VacationItem } from '@/lib/rh-api';

import { VacationApprovalButtons } from './_components/vacation-approval-buttons';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
  page?: string;
}

export default async function VacationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/rh/ferias');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/rh');
  if (!user.permissions.includes('rh:employees:view')) redirect('/perfil');

  const canApprove = user.permissions.includes('rh:vacations:approve');
  const page = Number(searchParams.page ?? 1);

  const res = await listVacations({
    status: searchParams.status,
    page,
    pageSize: 20,
  });

  const data = res.ok ? (res.data as PaginatedVacations) : null;
  const items: VacationItem[] = data?.items ?? [];
  const total = data?.total ?? 0;

  const fmt = new Intl.DateTimeFormat('pt-BR');

  const statusLabel: Record<string, { label: string; classes: string }> = {
    PENDING: { label: 'Pendente', classes: 'bg-amber-500/15 text-amber-400' },
    APPROVED: { label: 'Aprovado', classes: 'bg-emerald-500/15 text-emerald-400' },
    REJECTED: { label: 'Rejeitado', classes: 'bg-red-500/15 text-red-400' },
    CANCELLED: { label: 'Cancelado', classes: 'bg-white/5 text-ash' },
  };

  return (
    <AppShell
      pathname="/admin/rh"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'RH', href: '/admin/rh' },
        { label: 'Férias' },
      ]}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Recursos Humanos
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            Pedidos de férias
          </h1>
          <p className="mt-1 text-sm text-ash">{total} pedidos</p>
        </div>
      </header>

      {/* Status filter */}
      <form className="mb-6 flex flex-wrap gap-2">
        {['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => (
          <button
            key={s}
            name="status"
            value={s}
            type="submit"
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              (searchParams.status ?? '') === s
                ? 'bg-emerald-600 text-white'
                : 'border border-white/8 text-ash hover:border-emerald-500/40'
            }`}
          >
            {s === '' ? 'Todos' : statusLabel[s]?.label ?? s}
          </button>
        ))}
      </form>

      <div className="rounded-xl border border-white/8 bg-white/[0.02]">
        {items.length === 0 ? (
          <p className="p-10 text-center text-sm text-ash">
            Nenhum pedido encontrado.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{v.employeeName}</p>
                  <p className="text-xs text-ash">
                    {fmt.format(new Date(v.startDate))} → {fmt.format(new Date(v.endDate))} ·{' '}
                    {v.days} dias
                  </p>
                  {v.reason && (
                    <p className="mt-1 text-xs text-ash">{v.reason}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      statusLabel[v.status]?.classes ?? 'bg-white/5 text-ash'
                    }`}
                  >
                    {statusLabel[v.status]?.label ?? v.status}
                  </span>
                  {canApprove && v.status === 'PENDING' && (
                    <VacationApprovalButtons
                      vacationId={v.id}
                      accessToken={session.accessToken!}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
