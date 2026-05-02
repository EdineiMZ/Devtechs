import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listEmployees } from '@/lib/rh-api';
import type { EmployeeListItem, PaginatedEmployees } from '@/lib/rh-api';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  status?: string;
  department?: string;
  page?: string;
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/rh/funcionarios');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/rh');
  if (!user.permissions.includes('rh:employees:view')) redirect('/perfil');

  const page = Number(searchParams.page ?? 1);
  const res = await listEmployees({
    q: searchParams.q,
    status: searchParams.status,
    department: searchParams.department,
    page,
    pageSize: 20,
  });

  const data = res.ok ? (res.data as PaginatedEmployees) : null;
  const items: EmployeeListItem[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const canEdit = user.permissions.includes('rh:employees:edit');

  return (
    <AppShell
      pathname="/admin/rh"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'RH', href: '/admin/rh' },
        { label: 'Funcionários' },
      ]}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Recursos Humanos
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            Funcionários
          </h1>
          <p className="mt-1 text-sm text-ash">{total} registros</p>
        </div>
        {canEdit && (
          <Link
            href="/admin/rh/funcionarios/novo"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            + Adicionar
          </Link>
        )}
      </header>

      {/* Filters */}
      <form className="mb-6 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder="Buscar por nome ou e-mail"
          className="w-64 rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <select
          name="status"
          defaultValue={searchParams.status ?? ''}
          className="rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        >
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativo</option>
          <option value="ON_LEAVE">De licença</option>
          <option value="TERMINATED">Desligado</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-emerald-600/20 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-600/30"
        >
          Filtrar
        </button>
        {(searchParams.q || searchParams.status) && (
          <Link
            href="/admin/rh/funcionarios"
            className="rounded-md px-4 py-2 text-sm text-ash hover:text-foreground"
          >
            Limpar
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02]">
        {items.length === 0 ? (
          <p className="p-10 text-center text-sm text-ash">
            Nenhum funcionário encontrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-ash">
                  <th className="px-4 py-3 text-left font-medium">Nome</th>
                  <th className="px-4 py-3 text-left font-medium">Cargo</th>
                  <th className="px-4 py-3 text-left font-medium">Departamento</th>
                  <th className="px-4 py-3 text-left font-medium">Admissão</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {items.map((emp) => (
                  <tr key={emp.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{emp.name}</p>
                        <p className="text-xs text-ash">{emp.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ash">
                      {emp.position.name}
                    </td>
                    <td className="px-4 py-3 text-ash">
                      {emp.department.name}
                    </td>
                    <td className="px-4 py-3 text-ash">
                      {new Intl.DateTimeFormat('pt-BR').format(new Date(emp.hireDate))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          emp.status === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : emp.status === 'ON_LEAVE'
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {emp.status === 'ACTIVE'
                          ? 'Ativo'
                          : emp.status === 'ON_LEAVE'
                          ? 'Licença'
                          : 'Desligado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/rh/funcionarios/${emp.id}`}
                        className="text-xs text-copper hover:underline"
                      >
                        {canEdit ? 'Editar' : 'Ver'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/8 px-4 py-3">
            <p className="text-xs text-ash">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/rh/funcionarios?page=${page - 1}${searchParams.q ? `&q=${searchParams.q}` : ''}${searchParams.status ? `&status=${searchParams.status}` : ''}`}
                  className="rounded-md border border-white/8 px-3 py-1 text-xs hover:bg-white/[0.04]"
                >
                  Anterior
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/rh/funcionarios?page=${page + 1}${searchParams.q ? `&q=${searchParams.q}` : ''}${searchParams.status ? `&status=${searchParams.status}` : ''}`}
                  className="rounded-md border border-white/8 px-3 py-1 text-xs hover:bg-white/[0.04]"
                >
                  Próxima
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
