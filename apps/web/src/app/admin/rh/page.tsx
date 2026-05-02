import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listEmployees, listVacations } from '@/lib/rh-api';
import type { PaginatedEmployees, PaginatedVacations } from '@/lib/rh-api';

export const dynamic = 'force-dynamic';

export default async function RhDashboardPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/rh');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/rh');
  if (!user.permissions.includes('rh:employees:view')) redirect('/perfil');

  const [empRes, vacRes] = await Promise.all([
    listEmployees({ pageSize: 200 }),
    listVacations({ pageSize: 200 }),
  ]);

  const employees = empRes.ok
    ? ((empRes.data as PaginatedEmployees).items ?? [])
    : [];
  const vacations = vacRes.ok
    ? ((vacRes.data as PaginatedVacations).items ?? [])
    : [];

  const total = empRes.ok ? (empRes.data as PaginatedEmployees).total : 0;
  const active = employees.filter((e) => e.status === 'ACTIVE').length;
  const onVacation = vacations.filter((v) => v.status === 'APPROVED').length;
  const pendingVacations = vacations.filter((v) => v.status === 'PENDING').length;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const birthdays = employees.filter((e) => {
    try {
      return new Date(e.hireDate).getMonth() + 1 === currentMonth;
    } catch {
      return false;
    }
  }).length;

  const kpis = [
    { label: 'Total de funcionários', value: total, color: 'sky', href: '/admin/rh/funcionarios' },
    { label: 'Ativos', value: active, color: 'emerald', href: '/admin/rh/funcionarios?status=ACTIVE' },
    { label: 'Em férias', value: onVacation, color: 'amber', href: '/admin/rh/ferias?status=APPROVED' },
    { label: 'Pedidos pendentes', value: pendingVacations, color: 'violet', href: '/admin/rh/ferias?status=PENDING' },
    { label: 'Aniversariantes do mês', value: birthdays, color: 'rose', href: '/admin/rh/funcionarios' },
  ];

  const recentEmployees = employees.slice(0, 5);

  return (
    <AppShell
      pathname="/admin/rh"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Recursos Humanos' }]}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Recursos Humanos
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            Painel de RH
          </h1>
          <p className="mt-1 text-sm text-ash">
            Visão geral da equipe e solicitações
          </p>
        </div>
        {user.permissions.includes('rh:employees:edit') && (
          <Link
            href="/admin/rh/funcionarios/novo"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            + Adicionar funcionário
          </Link>
        )}
      </header>

      {/* KPI Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="rounded-xl border border-white/8 bg-white/[0.02] p-4 transition-all hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-md"
          >
            <p className="text-xs text-ash">{kpi.label}</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{kpi.value}</p>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { href: '/admin/rh/funcionarios', label: 'Funcionários', desc: 'Lista completa com filtros' },
          { href: '/admin/rh/cargos', label: 'Cargos', desc: 'Gestão de cargos e faixas salariais' },
          { href: '/admin/rh/departamentos', label: 'Departamentos', desc: 'Estrutura organizacional' },
          { href: '/admin/rh/ferias', label: 'Férias', desc: 'Pedidos e aprovações' },
          { href: '/admin/rh/escalas', label: 'Escalas', desc: 'Horários e turnos' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col gap-1 rounded-xl border border-white/8 bg-white/[0.02] p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-md"
          >
            <p className="font-semibold text-foreground">{item.label}</p>
            <p className="text-xs text-ash">{item.desc}</p>
          </Link>
        ))}
      </div>

      {/* Creation shortcuts — only for users with edit permission */}
      {user.permissions.includes('rh:employees:edit') && (
        <div className="mb-8 flex flex-wrap gap-3">
          <Link
            href="/admin/rh/cargos/novo"
            className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-4 py-2 text-sm text-ash transition-all hover:border-emerald-500/30 hover:text-white"
          >
            <span className="text-emerald-400">+</span>
            Criar cargo
          </Link>
          <Link
            href="/admin/rh/departamentos/novo"
            className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-4 py-2 text-sm text-ash transition-all hover:border-emerald-500/30 hover:text-white"
          >
            <span className="text-emerald-400">+</span>
            Criar departamento
          </Link>
        </div>
      )}

      {/* Recent employees */}
      <section className="rounded-xl border border-white/8 bg-white/[0.02]">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Funcionários recentes</h2>
          <Link href="/admin/rh/funcionarios" className="text-xs text-copper hover:underline">
            Ver todos
          </Link>
        </div>
        {recentEmployees.length === 0 ? (
          <p className="p-8 text-center text-sm text-ash">
            Nenhum funcionário cadastrado ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {recentEmployees.map((emp) => (
              <li key={emp.id}>
                <Link
                  href={`/admin/rh/funcionarios/${emp.id}`}
                  className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-white/[0.04]"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{emp.name}</p>
                    <p className="text-xs text-ash">
                      {emp.position.name} · {emp.department.name}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      emp.status === 'ACTIVE'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-white/5 text-ash'
                    }`}
                  >
                    {emp.status === 'ACTIVE' ? 'Ativo' : emp.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
