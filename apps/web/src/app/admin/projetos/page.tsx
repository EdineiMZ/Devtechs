import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listProjects } from '@/lib/projects-api';
import type { PaginatedProjects, ProjectListItem } from '@/lib/projects-api';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
  q?: string;
  page?: string;
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-400',
  PLANNING: 'bg-sky-500/15 text-sky-400',
  ON_HOLD: 'bg-amber-500/15 text-amber-400',
  COMPLETED: 'bg-violet-500/15 text-violet-400',
  CANCELLED: 'bg-white/5 text-ash',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Ativo',
  PLANNING: 'Planejamento',
  ON_HOLD: 'Pausado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

export default async function ProjetosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/projetos');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/projetos');
  if (!user.permissions.includes('projects:reports:view')) redirect('/perfil');

  const page = Number(searchParams.page ?? 1);
  const res = await listProjects(
    {
      status: searchParams.status,
      q: searchParams.q,
      page,
      pageSize: 12,
    },
    session.accessToken,
  ).catch(() => ({ ok: false as const, status: 500, data: null }));
  const data = res.ok ? (res.data as PaginatedProjects) : null;
  const items: ProjectListItem[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const dateFmt = new Intl.DateTimeFormat('pt-BR');

  return (
    <AppShell
      pathname="/admin/projetos"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Projetos' }]}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">
            Projetos
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            Todos os projetos
          </h1>
          <p className="mt-1 text-sm text-ash">{total} projetos</p>
        </div>
        {user.permissions.includes('projects:create') && (
          <Link
            href="/admin/projetos/novo"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            + Novo projeto
          </Link>
        )}
      </header>

      {/* Filters */}
      <form className="mb-6 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder="Buscar projeto…"
          className="w-60 rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
        />
        <select
          name="status"
          defaultValue={searchParams.status ?? ''}
          className="rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
        >
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativo</option>
          <option value="PLANNING">Planejamento</option>
          <option value="ON_HOLD">Pausado</option>
          <option value="COMPLETED">Concluído</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-violet-600/20 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-600/30"
        >
          Filtrar
        </button>
      </form>

      {/* Project cards */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/8 p-12 text-center text-sm text-ash">
          Nenhum projeto encontrado.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((project) => (
            <Link
              key={project.id}
              href={`/admin/projetos/${project.id}`}
              className="flex flex-col rounded-xl border border-white/8 bg-white/[0.02] p-5 transition-all hover:-translate-y-0.5 hover:border-violet-500/30 hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight text-foreground">{project.name}</h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    statusColors[project.status] ?? 'bg-white/5 text-ash'
                  }`}
                >
                  {statusLabels[project.status] ?? project.status}
                </span>
              </div>

              {project.description && (
                <p className="mb-3 line-clamp-2 text-xs text-ash">
                  {project.description}
                </p>
              )}

              <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-ash">
                {project.client && (
                  <span>Cliente: {project.client.name ?? project.client.email}</span>
                )}
                {project.endDate && (
                  <span>Deadline: {dateFmt.format(new Date(project.endDate))}</span>
                )}
                <span>{project.taskCount} tarefas</span>
                <span>{project.memberCount} membros</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/admin/projetos?page=${page - 1}${searchParams.status ? `&status=${encodeURIComponent(searchParams.status)}` : ''}`}
              className="rounded-md border border-white/8 px-3 py-1 text-sm hover:bg-white/[0.04]"
            >
              Anterior
            </Link>
          )}
          <span className="text-xs text-ash">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/projetos?page=${page + 1}${searchParams.status ? `&status=${encodeURIComponent(searchParams.status)}` : ''}`}
              className="rounded-md border border-white/8 px-3 py-1 text-sm hover:bg-white/[0.04]"
            >
              Próxima
            </Link>
          )}
        </div>
      )}
    </AppShell>
  );
}
