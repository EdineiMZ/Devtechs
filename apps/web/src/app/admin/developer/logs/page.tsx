import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';

import { LogsViewer } from './logs-viewer';

export const dynamic = 'force-dynamic';

export default async function DeveloperLogsPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/developer/logs');
  const user = session.user;
  if (!user.permissions.includes('dev:logs:view')) redirect('/perfil');

  return (
    <AppShell
      pathname="/admin/developer/logs"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Developer', href: '/admin/developer' },
        { label: 'Logs' },
      ]}
    >
      <div className="flex h-[calc(100vh-8rem)] flex-col">
        <header className="mb-4">
          <h1 className="text-3xl font-bold tracking-tight">Logs ao vivo</h1>
          <p className="mt-1 text-sm text-ash">Stream de logs dos containers Docker · atualiza a cada 3s</p>
        </header>
        <LogsViewer />
      </div>
    </AppShell>
  );
}
