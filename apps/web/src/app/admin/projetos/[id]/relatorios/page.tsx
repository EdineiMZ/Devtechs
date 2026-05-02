import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { getActiveSprint, getProject } from '@/lib/projects-api';
import type { ActiveSprintResponse, ProjectDetail } from '@/lib/projects-api';

import { BurndownChart } from './_components/burndown-chart';

export const dynamic = 'force-dynamic';

export default async function RelatoriosPage({
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

  const totalTasks = sprint?.tasks.length ?? 0;
  const doneTasks = sprint?.tasks.filter((t) => t.status === 'DONE').length ?? 0;
  const inProgressTasks = sprint?.tasks.filter((t) => t.status === 'IN_PROGRESS').length ?? 0;

  return (
    <AppShell
      pathname="/admin/projetos"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Projetos', href: '/admin/projetos' },
        { label: project?.name ?? params.id, href: `/admin/projetos/${params.id}` },
        { label: 'Relatórios' },
      ]}
    >
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">Projetos</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
          Relatórios — {project?.name}
        </h1>
      </header>

      <div className="grid gap-6">
        {/* Velocity stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Total de tarefas', value: totalTasks },
            { label: 'Concluídas', value: doneTasks },
            { label: 'Em andamento', value: inProgressTasks },
            {
              label: 'Horas registradas',
              value: sprint?.burndown.loggedHours.toFixed(1) ?? '—',
            },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-xs text-ash">{stat.label}</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Burndown chart */}
        {sprint && sprint.burndown.points.length > 0 ? (
          <section className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              Burndown — {sprint.sprint.name}
            </h2>
            <BurndownChart points={sprint.burndown.points} />
          </section>
        ) : (
          <div className="rounded-xl border border-dashed border-white/8 p-8 text-center text-sm text-ash">
            Nenhum sprint ativo com dados de burndown.
          </div>
        )}

        {/* Members time tracking */}
        {project && (
          <section className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Membros do projeto</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-ash">
                    <th className="pb-2 text-left font-medium">Membro</th>
                    <th className="pb-2 text-left font-medium">E-mail</th>
                    <th className="pb-2 text-left font-medium">Função</th>
                    <th className="pb-2 text-left font-medium">Entrada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {project.members.map((m) => (
                    <tr key={m.user.id}>
                      <td className="py-2 pr-4 font-medium text-foreground">{m.user.name ?? m.user.email}</td>
                      <td className="py-2 pr-4 text-ash">{m.user.email}</td>
                      <td className="py-2 pr-4">
                        <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] text-violet-400">
                          {m.role}
                        </span>
                      </td>
                      <td className="py-2 text-ash">
                        {new Intl.DateTimeFormat('pt-BR').format(new Date(m.joinedAt))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
