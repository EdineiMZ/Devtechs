import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { getActiveSprint, getProject } from '@/lib/projects-api';
import type { ActiveSprintResponse, ProjectDetail } from '@/lib/projects-api';

export const dynamic = 'force-dynamic';

export default async function SprintsPage({
  params,
}: {
  params: { id: string };
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/projetos');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/projetos');
  if (!user.permissions.includes('projects:reports:view')) redirect('/perfil');

  const [projRes, sprintRes] = await Promise.all([
    getProject(params.id, session.accessToken),
    getActiveSprint(params.id, session.accessToken),
  ]);

  const project = projRes.ok ? (projRes.data as ProjectDetail) : null;
  const sprint = sprintRes.ok ? (sprintRes.data as ActiveSprintResponse) : null;

  const dateFmt = new Intl.DateTimeFormat('pt-BR');

  const priorityColors: Record<string, string> = {
    CRITICAL: 'bg-red-500/15 text-red-400',
    HIGH: 'bg-orange-500/15 text-orange-400',
    MEDIUM: 'bg-amber-500/15 text-amber-400',
    LOW: 'bg-sky-500/15 text-sky-400',
  };

  return (
    <AppShell
      pathname="/admin/projetos"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Projetos', href: '/admin/projetos' },
        { label: project?.name ?? params.id, href: `/admin/projetos/${params.id}` },
        { label: 'Sprints' },
      ]}
    >
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">Projetos</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
          Sprint ativo — {project?.name}
        </h1>
      </header>

      {!sprint ? (
        <div className="rounded-xl border border-dashed border-white/8 p-10 text-center text-sm text-ash">
          Nenhum sprint ativo neste projeto.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Sprint info */}
          <section className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Detalhes do sprint</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-ash">Nome</dt>
                <dd className="font-medium text-foreground">{sprint.sprint.name}</dd>
              </div>
              {sprint.sprint.goal && (
                <div>
                  <dt className="text-xs text-ash">Meta</dt>
                  <dd className="text-foreground">{sprint.sprint.goal}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-ash">Período</dt>
                <dd className="text-foreground">
                  {dateFmt.format(new Date(sprint.sprint.startDate))} →{' '}
                  {dateFmt.format(new Date(sprint.sprint.endDate))}
                </dd>
              </div>
              <div className="pt-2">
                <div className="mb-1 flex justify-between text-xs text-ash">
                  <span>Progresso</span>
                  <span>
                    {sprint.burndown.loggedHours.toFixed(1)}h /{' '}
                    {sprint.burndown.totalHours.toFixed(1)}h
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        sprint.burndown.totalHours > 0
                          ? (sprint.burndown.loggedHours / sprint.burndown.totalHours) * 100
                          : 0,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </dl>
          </section>

          {/* Task list */}
          <section className="col-span-2 rounded-xl border border-white/8 bg-white/[0.02]">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                Tarefas do sprint ({sprint.tasks.length})
              </h2>
              <Link
                href={`/admin/projetos/${params.id}`}
                className="text-xs text-copper hover:underline"
              >
                Ver kanban
              </Link>
            </div>
            <ul className="divide-y divide-border/60">
              {sprint.tasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{task.title}</p>
                    {task.assignee && (
                      <p className="text-xs text-ash">
                        {task.assignee.name ?? task.assignee.email}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        priorityColors[task.priority] ?? 'bg-white/5 text-ash'
                      }`}
                    >
                      {task.priority}
                    </span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-ash">
                      {task.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </AppShell>
  );
}
