import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { getProject, getProjectBoard } from '@/lib/projects-api';
import type { BoardResponse, ProjectDetail } from '@/lib/projects-api';

import { KanbanBoard } from './_components/kanban-board';
import { MembersPanel } from './_components/members-panel';
import { MilestonesPanel } from './_components/milestones-panel';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/projetos');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/projetos');
  if (!user.permissions.includes('projects:reports:view')) redirect('/perfil');

  const [projRes, boardRes] = await Promise.all([
    getProject(params.id, session.accessToken),
    getProjectBoard(params.id, session.accessToken),
  ]);

  if (!projRes.ok) {
    return (
      <AppShell
        pathname="/admin/projetos"
        navItems={ADMIN_NAV_ITEMS}
        permissions={user.permissions}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Projetos', href: '/admin/projetos' },
          { label: 'Não encontrado' },
        ]}
      >
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-10 text-center">
          <p className="text-sm text-ash">Projeto não encontrado.</p>
          <Link href="/admin/projetos" className="mt-4 inline-block text-sm text-copper hover:underline">
            Voltar
          </Link>
        </div>
      </AppShell>
    );
  }

  const project = projRes.data as ProjectDetail;
  const board = boardRes.ok ? (boardRes.data as BoardResponse) : null;
  const canMove = user.permissions.includes('projects:tasks:assign');
  const canEditProject =
    user.permissions.includes('projects:create') ||
    user.permissions.includes('projects:tasks:assign');

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/15 text-emerald-400',
    PLANNING: 'bg-sky-500/15 text-sky-400',
    ON_HOLD: 'bg-amber-500/15 text-amber-400',
    COMPLETED: 'bg-violet-500/15 text-violet-400',
  };

  const dateFmt = new Intl.DateTimeFormat('pt-BR');

  return (
    <AppShell
      pathname="/admin/projetos"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Projetos', href: '/admin/projetos' },
        { label: project.name },
      ]}
    >
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">Projetos</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            {project.name}
          </h1>
          {project.description && (
            <p className="mt-1 text-sm text-ash">{project.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              statusColors[project.status] ?? 'bg-white/5 text-ash'
            }`}
          >
            {project.status}
          </span>
          <Link
            href={`/admin/projetos/${project.id}/sprints`}
            className="rounded-lg border border-white/8 px-3 py-1.5 text-sm text-ash hover:text-foreground"
          >
            Sprints
          </Link>
          <Link
            href={`/admin/projetos/${project.id}/relatorios`}
            className="rounded-lg border border-white/8 px-3 py-1.5 text-sm text-ash hover:text-foreground"
          >
            Relatórios
          </Link>
        </div>
      </div>

      {/* Meta */}
      <div className="mb-4 flex flex-wrap gap-6 text-xs text-ash">
        <span>Owner: <strong className="text-foreground">{project.owner.name}</strong></span>
        {project.client && (
          <span>Cliente: <strong className="text-foreground">{project.client.name}</strong></span>
        )}
        <span>Início: {dateFmt.format(new Date(project.startDate))}</span>
        {project.endDate && <span>Deadline: {dateFmt.format(new Date(project.endDate))}</span>}
        <span>{project.memberCount} membros · {project.taskCount} tarefas</span>
        {project.githubRepo && (
          <a
            href={project.githubRepo.startsWith('http') ? project.githubRepo : `https://github.com/${project.githubRepo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sky-400 hover:underline"
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
            GitHub
          </a>
        )}
      </div>

      {/* Milestones / Progress */}
      <div className="mb-6">
        <MilestonesPanel
          projectId={project.id}
          accessToken={session.accessToken!}
          initialMilestones={project.milestones ?? []}
          progressPercent={project.progressPercent ?? 0}
          canEdit={canEditProject}
        />
      </div>

      {/* Team members */}
      <div className="mb-6">
        <MembersPanel
          projectId={project.id}
          accessToken={session.accessToken!}
          initialMembers={project.members ?? []}
          canEdit={canEditProject}
        />
      </div>

      {/* Kanban board */}
      {board ? (
        <KanbanBoard
          board={board}
          canMove={canMove}
          accessToken={session.accessToken!}
          projectId={project.id}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-white/8 p-10 text-center text-sm text-ash">
          Board não disponível. Verifique se o projeto possui colunas configuradas.
        </div>
      )}
    </AppShell>
  );
}
