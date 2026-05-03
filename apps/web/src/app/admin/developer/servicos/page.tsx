import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { devFetch, getDeveloperServiceUrl } from '@/lib/developer-api';

import { MonitorPanel } from './monitor-panel';

export const dynamic = 'force-dynamic';

interface ServiceStatus {
  name: string;
  displayName: string;
  port: number;
  online: boolean;
  responseMs: number | null;
  lastChecked: string;
  upSince: string | null;
  downSince: string | null;
  consecutiveFailures: number;
  autoRestart: boolean;
}

export default async function ServicosPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/developer/servicos');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/developer/servicos');
  if (!user.permissions.includes('dev:logs:view')) redirect('/perfil');

  const res = await devFetch<ServiceStatus[]>('/monitor', {
    accessToken: session.accessToken,
  }).catch(() => ({ ok: false as const, status: 500, data: [] }));

  const initial: ServiceStatus[] = res.ok && Array.isArray(res.data)
    ? (res.data as ServiceStatus[])
    : [];

  const canControl = user.permissions.includes('dev:services:restart');
  const wsUrl = getDeveloperServiceUrl();

  return (
    <AppShell
      pathname="/admin/developer"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Developer', href: '/admin/developer' },
        { label: 'Monitor de Serviços' },
      ]}
    >
      <header className="mb-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
          {'// services monitor'}
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">
          Monitor de Serviços
        </h1>
        <p className="mt-1 font-body text-sm text-ash">
          Status em tempo real, controle e logs de cada microserviço
        </p>
      </header>

      <MonitorPanel
        initial={initial}
        accessToken={session.accessToken}
        wsUrl={wsUrl}
        canControl={canControl}
      />
    </AppShell>
  );
}
