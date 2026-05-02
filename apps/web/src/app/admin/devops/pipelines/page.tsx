import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listPipelines } from '@/lib/devops-api';
import type { PaginatedPipelines, Pipeline, PipelineStatus } from '@/lib/devops-api';

import { TriggerPipelineButton } from './_components/trigger-pipeline-button';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
  branch?: string;
  page?: string;
}

const statusColors: Record<PipelineStatus, string> = {
  QUEUED: 'bg-sky-500/15 text-sky-400',
  RUNNING: 'bg-amber-500/15 text-amber-400',
  SUCCESS: 'bg-emerald-500/15 text-emerald-400',
  FAILED: 'bg-red-500/15 text-red-400',
  CANCELLED: 'bg-white/5 text-ash',
};

export default async function PipelinesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/devops/pipelines');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/devops');
  if (!user.permissions.includes('devops:pipelines:view')) redirect('/perfil');

  const page = Number(searchParams.page ?? 1);
  const res = await listPipelines({
    status: searchParams.status as PipelineStatus | undefined,
    branch: searchParams.branch,
    page,
    pageSize: 20,
  });

  const data = res.ok ? (res.data as PaginatedPipelines) : null;
  const items: Pipeline[] = data?.items ?? [];
  const total = data?.total ?? 0;

  const canTrigger = user.permissions.includes('devops:deploys:trigger');
  const dateFmt = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <AppShell
      pathname="/admin/devops"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'DevOps', href: '/admin/devops' },
        { label: 'Pipelines' },
      ]}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">DevOps</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Pipelines</h1>
          <p className="mt-1 text-sm text-ash">{total} pipelines</p>
        </div>
        {canTrigger && (
          <TriggerPipelineButton accessToken={session.accessToken!} />
        )}
      </header>

      {/* Filters */}
      <form className="mb-6 flex flex-wrap gap-3">
        <select
          name="status"
          defaultValue={searchParams.status ?? ''}
          className="rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
        >
          <option value="">Todos os status</option>
          <option value="QUEUED">Na fila</option>
          <option value="RUNNING">Executando</option>
          <option value="SUCCESS">Sucesso</option>
          <option value="FAILED">Falhou</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
        <input
          name="branch"
          defaultValue={searchParams.branch ?? ''}
          placeholder="Branch (ex: main)"
          className="rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-amber-600/20 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-600/30"
        >
          Filtrar
        </button>
      </form>

      <div className="rounded-xl border border-white/8 bg-white/[0.02]">
        {items.length === 0 ? (
          <p className="p-10 text-center text-sm text-ash">
            Nenhum pipeline encontrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-ash">
                  <th className="px-4 py-3 text-left font-medium">Repositório / Branch</th>
                  <th className="px-4 py-3 text-left font-medium">Workflow</th>
                  <th className="px-4 py-3 text-left font-medium">Início</th>
                  <th className="px-4 py-3 text-left font-medium">Duração</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {items.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {p.owner}/{p.repo}
                      </p>
                      <p className="text-xs text-ash font-mono">{p.branch}</p>
                    </td>
                    <td className="px-4 py-3 text-ash font-mono text-xs">
                      {p.workflowId}
                    </td>
                    <td className="px-4 py-3 text-ash text-xs">
                      {p.startedAt ? dateFmt.format(new Date(p.startedAt)) : '—'}
                    </td>
                    <td className="px-4 py-3 text-ash text-xs">
                      {p.durationMs ? `${(p.durationMs / 1000).toFixed(0)}s` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          statusColors[p.status]
                        }`}
                      >
                        {p.status}
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
