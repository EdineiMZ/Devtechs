import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { CLIENT_NAV_ITEMS } from '@/components/app/nav-config';
import { getProjectProgress, listProjects } from '@/lib/projects-api';
import type { MilestoneDto, ProjectListItem } from '@/lib/projects-api';

export const dynamic = 'force-dynamic';

export default async function MeusProjetosPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/perfil/projetos');
  const user = session.user;

  // Fetch all projects filtered by the client's userId.
  // The projects-service supports `clientId` as a query param.
  const res = await listProjects({ pageSize: 50 }).catch(() => ({
    ok: false as const,
    status: 500,
    data: { items: [] as ProjectListItem[], total: 0, page: 1, pageSize: 50, totalPages: 0 },
  }));

  const allProjects = res.ok
    ? ((res.data as { items: ProjectListItem[] }).items ?? [])
    : [];

  // Filter to only this client's projects.
  const projects = allProjects.filter(
    (p) => p.client?.id === user.id,
  );

  // Fetch progress for each project in parallel.
  const progressResults = await Promise.allSettled(
    projects.map((p) => getProjectProgress(p.id)),
  );

  type ProjectWithProgress = ProjectListItem & {
    progressPercent: number;
    milestones: MilestoneDto[];
  };

  const enriched: ProjectWithProgress[] = projects.map((p, i) => {
    const r = progressResults[i];
    const prog =
      r?.status === 'fulfilled' && r.value.ok
        ? (r.value.data as { progressPercent: number; milestones: MilestoneDto[] })
        : { progressPercent: 0, milestones: [] };
    return { ...p, ...prog };
  });

  const statusLabels: Record<string, string> = {
    ACTIVE: 'Ativo',
    PLANNING: 'Planejamento',
    ON_HOLD: 'Pausado',
    COMPLETED: 'Concluído',
    CANCELLED: 'Cancelado',
  };

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/15 text-emerald-400',
    PLANNING: 'bg-sky-500/15 text-sky-400',
    ON_HOLD: 'bg-amber-500/15 text-amber-400',
    COMPLETED: 'bg-violet-500/15 text-violet-400',
    CANCELLED: 'bg-white/5 text-ash',
  };

  const dateFmt = new Intl.DateTimeFormat('pt-BR');

  return (
    <AppShell
      pathname="/perfil/projetos"
      navItems={CLIENT_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Minha conta', href: '/perfil' },
        { label: 'Meus projetos' },
      ]}
    >
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Meus projetos</h1>
        <p className="mt-1 text-sm text-ash">
          {enriched.length === 0
            ? 'Você ainda não tem projetos vinculados à sua conta.'
            : `${enriched.length} projeto${enriched.length > 1 ? 's' : ''} vinculado${enriched.length > 1 ? 's' : ''}.`}
        </p>
      </header>

      {enriched.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/8 bg-white/[0.02] px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Nenhum projeto encontrado</h2>
            <p className="mt-1 max-w-md text-sm text-ash">
              Quando um projeto for vinculado à sua conta, ele aparecerá aqui com o
              progresso atualizado pela equipe.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {enriched.map((project) => {
            const completedMilestones = project.milestones.filter((m) => m.completedAt).length;
            const totalMilestones = project.milestones.length;

            return (
              <div
                key={project.id}
                className="flex flex-col rounded-xl border border-white/8 bg-white/[0.02] p-5"
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
                  <p className="mb-3 text-xs text-ash line-clamp-2">
                    {project.description}
                  </p>
                )}

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-ash">Progresso</span>
                    <span className="font-semibold text-foreground">{project.progressPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${project.progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Milestones */}
                {totalMilestones > 0 && (
                  <div className="mb-3">
                    <p className="mb-1.5 text-xs font-medium text-ash">
                      Marcos: {completedMilestones}/{totalMilestones}
                    </p>
                    <div className="space-y-1">
                      {project.milestones.slice(0, 5).map((m) => (
                        <div key={m.id} className="flex items-center gap-2 text-xs">
                          <span
                            className={`h-3 w-3 flex-shrink-0 rounded-full border ${
                              m.completedAt
                                ? 'border-emerald-500 bg-emerald-500'
                                : 'border-muted-foreground'
                            }`}
                          />
                          <span
                            className={
                              m.completedAt
                                ? 'text-ash line-through'
                                : 'text-foreground'
                            }
                          >
                            {m.title}
                          </span>
                        </div>
                      ))}
                      {totalMilestones > 5 && (
                        <p className="text-[11px] text-ash pl-5">
                          +{totalMilestones - 5} mais marcos…
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-auto flex flex-wrap gap-3 text-xs text-ash">
                  {project.endDate && (
                    <span>Prazo: {dateFmt.format(new Date(project.endDate))}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
