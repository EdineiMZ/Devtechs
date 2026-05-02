import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listDeployments, listPipelines } from '@/lib/devops-api';
import type { Deployment, PaginatedPipelines } from '@/lib/devops-api';

export const dynamic = 'force-dynamic';

const PIPELINE_STATUS: Record<string, string> = {
  QUEUED:    'bg-sky-500/15 text-sky-400 border border-sky-500/20',
  RUNNING:   'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  SUCCESS:   'bg-acid/10 text-acid border border-acid/20',
  FAILED:    'bg-red-500/15 text-red-400 border border-red-500/20',
  CANCELLED: 'bg-white/5 text-ash border border-white/8',
};

export default async function DevOpsDashboardPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/devops');
  const user = session.user;
  if (!user.permissions.includes('devops:pipelines:view')) redirect('/perfil');

  const [pipelinesRes, deploymentsRes] = await Promise.all([
    listPipelines({ pageSize: 5 }),
    listDeployments(),
  ]);

  const pipelines =
    pipelinesRes.ok ? ((pipelinesRes.data as PaginatedPipelines).items ?? []) : [];
  const deployments =
    deploymentsRes.ok ? ((deploymentsRes.data as Deployment[]) ?? []) : [];

  const recentDeploys = deployments.slice(0, 5);

  const dateFmt = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <AppShell
      pathname="/admin/devops"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'DevOps' }]}
    >
      {/* Page header */}
      <header className="mb-8">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-copper">
          // devops
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">
          Painel DevOps
        </h1>
        <p className="mt-1 font-body text-sm text-ash">
          Pipelines, deploys e saúde dos serviços
        </p>
      </header>

      {/* Quick nav */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { href: '/admin/devops/pipelines', label: 'Pipelines', desc: 'CI/CD e builds',        icon: '⬡' },
          { href: '/admin/devops/deploys',   label: 'Deploys',   desc: 'Histórico e rollback',  icon: '⬡' },
          { href: '/admin/devops/logs',      label: 'Logs',      desc: 'Stream em tempo real',  icon: '⬡' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex flex-col gap-1.5 rounded-xl border border-white/8 bg-white/[0.02] p-5 transition-all hover:-translate-y-0.5 hover:border-copper/25 hover:bg-white/[0.04] hover:shadow-[0_0_20px_hsl(28,72%,58%,0.08)]"
          >
            {/* Top accent on hover */}
            <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-copper/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <p className="font-display font-semibold text-foreground">{item.label}</p>
            <p className="font-body text-xs text-ash">{item.desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent pipelines */}
        <section className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
            <h2 className="font-display text-sm font-semibold text-foreground">
              Pipelines recentes
            </h2>
            <Link
              href="/admin/devops/pipelines"
              className="font-body text-xs text-copper hover:text-copper/80 transition-colors"
            >
              Ver todos
            </Link>
          </div>
          {pipelines.length === 0 ? (
            <p className="p-8 text-center font-body text-sm text-ash/60">
              Nenhum pipeline encontrado.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {pipelines.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors">
                  <div>
                    <p className="font-body text-sm font-medium text-foreground">
                      {p.repo}/{p.branch}
                    </p>
                    <p className="font-mono text-xs text-ash/60">
                      {p.workflowId}
                      {p.startedAt && ` · ${dateFmt.format(new Date(p.startedAt))}`}
                    </p>
                  </div>
                  <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-medium ${PIPELINE_STATUS[p.status] ?? 'bg-white/5 text-ash border border-white/8'}`}>
                    {p.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent deploys */}
        <section className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
            <h2 className="font-display text-sm font-semibold text-foreground">
              Deploys recentes
            </h2>
            <Link
              href="/admin/devops/deploys"
              className="font-body text-xs text-copper hover:text-copper/80 transition-colors"
            >
              Ver todos
            </Link>
          </div>
          {recentDeploys.length === 0 ? (
            <p className="p-8 text-center font-body text-sm text-ash/60">
              Nenhum deploy encontrado.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {recentDeploys.map((d) => (
                <li key={d.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors">
                  <div>
                    <p className="font-body text-sm font-medium text-foreground">
                      {d.service} → {d.environment}
                    </p>
                    <p className="font-mono text-xs text-ash/60">
                      {d.imageTag} · {dateFmt.format(new Date(d.deployedAt))}
                    </p>
                  </div>
                  <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-medium ${
                    d.status === 'SUCCESS' ? 'bg-acid/10 text-acid border border-acid/20'
                    : d.status === 'FAILED' ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                  }`}>
                    {d.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
