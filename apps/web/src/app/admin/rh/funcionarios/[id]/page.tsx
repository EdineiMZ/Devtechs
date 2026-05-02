import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { getEmployee, listWorkSchedules } from '@/lib/rh-api';
import type { EmployeeDetail, WorkScheduleHistoryResponse } from '@/lib/rh-api';

export const dynamic = 'force-dynamic';

export default async function EmployeeDetailPage({
  params,
}: {
  params: { id: string };
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/rh/funcionarios');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/rh');
  if (!user.permissions.includes('rh:employees:view')) redirect('/perfil');

  const [empRes, schedRes] = await Promise.all([
    getEmployee(params.id),
    listWorkSchedules(params.id),
  ]);

  if (!empRes.ok) {
    return (
      <AppShell
        pathname="/admin/rh"
        navItems={ADMIN_NAV_ITEMS}
        permissions={user.permissions}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'RH', href: '/admin/rh' },
          { label: 'Funcionários', href: '/admin/rh/funcionarios' },
          { label: 'Não encontrado' },
        ]}
      >
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-10 text-center">
          <p className="text-sm text-ash">
            Funcionário não encontrado ou sem permissão de acesso.
          </p>
          <Link
            href="/admin/rh/funcionarios"
            className="mt-4 inline-block text-sm text-copper hover:underline"
          >
            Voltar à lista
          </Link>
        </div>
      </AppShell>
    );
  }

  const emp = empRes.data as EmployeeDetail;
  const schedules = schedRes.ok
    ? ((schedRes.data as WorkScheduleHistoryResponse).items ?? [])
    : [];

  const canEdit = user.permissions.includes('rh:employees:edit');
  const fmt = new Intl.DateTimeFormat('pt-BR');

  return (
    <AppShell
      pathname="/admin/rh"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'RH', href: '/admin/rh' },
        { label: 'Funcionários', href: '/admin/rh/funcionarios' },
        { label: emp.name },
      ]}
    >
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Funcionário
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            {emp.name}
          </h1>
          <p className="mt-1 text-sm text-ash">
            {emp.position.name} · {emp.department.name}
          </p>
        </div>
        <div className="flex gap-2">
          <span
            className={`self-start rounded-full px-3 py-1 text-sm font-medium ${
              emp.status === 'ACTIVE'
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-white/5 text-ash'
            }`}
          >
            {emp.status === 'ACTIVE' ? 'Ativo' : emp.status}
          </span>
          {canEdit && (
            <Link
              href={`/admin/rh/funcionarios/novo?edit=${emp.id}`}
              className="rounded-lg border border-emerald-500/30 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10"
            >
              Editar
            </Link>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Personal info */}
        <section className="col-span-2 rounded-xl border border-white/8 bg-white/[0.02] p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Dados pessoais</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              { label: 'E-mail', value: emp.email },
              { label: 'Telefone', value: emp.phone ?? '—' },
              { label: 'CPF', value: emp.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') },
              { label: 'Nascimento', value: fmt.format(new Date(emp.birthDate)) },
              { label: 'Admissão', value: fmt.format(new Date(emp.hireDate)) },
              {
                label: 'Demissão',
                value: emp.dismissDate ? fmt.format(new Date(emp.dismissDate)) : '—',
              },
              { label: 'Gestor', value: emp.manager?.name ?? '—' },
              { label: 'Cargo nível', value: emp.position.level },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-ash">{label}</dt>
                <dd className="font-medium text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Schedule history */}
        <section className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Histórico de escala</h2>
          {schedules.length === 0 ? (
            <p className="text-xs text-ash">Sem escalas cadastradas.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {schedules.slice(0, 5).map((s) => (
                <li key={s.id} className="rounded-lg border border-white/8 p-3 text-xs">
                  <p className="font-medium text-foreground">{s.scheduleType}</p>
                  <p className="text-ash">
                    {fmt.format(new Date(s.startDate))}
                    {s.endDate ? ` → ${fmt.format(new Date(s.endDate))}` : ' → atual'}
                  </p>
                  <p className="text-ash">{s.hoursPerDay}h/dia</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Documents */}
        {emp.documents.length > 0 && (
          <section className="col-span-full rounded-xl border border-white/8 bg-white/[0.02] p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Documentos</h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {emp.documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-white/8 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">{doc.name}</p>
                    <p className="text-xs text-ash">{doc.type}</p>
                  </div>
                  {doc.downloadUrl && (
                    <a
                      href={doc.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-copper hover:underline"
                    >
                      Download
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Subordinates */}
        {emp.subordinates.length > 0 && (
          <section className="col-span-full rounded-xl border border-white/8 bg-white/[0.02] p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              Subordinados ({emp.subordinates.length})
            </h2>
            <ul className="flex flex-wrap gap-2">
              {emp.subordinates.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/admin/rh/funcionarios/${s.id}`}
                    className="rounded-full border border-white/8 bg-background px-3 py-1 text-xs hover:border-emerald-500/40"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}
