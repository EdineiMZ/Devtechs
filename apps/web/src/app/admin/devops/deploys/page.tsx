import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listDeployments } from '@/lib/devops-api';
import type { Deployment } from '@/lib/devops-api';

import { RollbackButton } from './_components/rollback-button';

export const dynamic = 'force-dynamic';

export default async function DeploysPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/devops/deploys');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/devops');
  if (!user.permissions.includes('devops:pipelines:view')) redirect('/perfil');

  const res = await listDeployments();
  const deployments: Deployment[] = res.ok ? (res.data as Deployment[]) : [];
  const canRollback = user.permissions.includes('devops:rollback:execute');

  const dateFmt = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
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
        { label: 'Deploys' },
      ]}
    >
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">DevOps</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
          Histórico de deploys
        </h1>
        <p className="mt-1 text-sm text-ash">
          {deployments.length} deploys registrados
        </p>
      </header>

      <div className="rounded-xl border border-white/8 bg-white/[0.02]">
        {deployments.length === 0 ? (
          <p className="p-10 text-center text-sm text-ash">
            Nenhum deploy encontrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-ash">
                  <th className="px-4 py-3 text-left font-medium">Serviço</th>
                  <th className="px-4 py-3 text-left font-medium">Ambiente</th>
                  <th className="px-4 py-3 text-left font-medium">Imagem</th>
                  <th className="px-4 py-3 text-left font-medium">Data</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  {canRollback && (
                    <th className="px-4 py-3 text-right font-medium">Ação</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {deployments.map((d) => (
                  <tr key={d.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-medium text-foreground">{d.service}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          d.environment === 'production'
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-sky-500/15 text-sky-400'
                        }`}
                      >
                        {d.environment}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ash">
                      {d.imageTag}
                    </td>
                    <td className="px-4 py-3 text-xs text-ash">
                      {dateFmt.format(new Date(d.deployedAt))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          d.status === 'SUCCESS'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : d.status === 'FAILED'
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    {canRollback && (
                      <td className="px-4 py-3 text-right">
                        <RollbackButton
                          deploymentId={d.id}
                          service={d.service}
                          imageTag={d.imageTag}
                          accessToken={session.accessToken!}
                        />
                      </td>
                    )}
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
