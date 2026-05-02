import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { devFetch } from '@/lib/developer-api';

import { ConfigPanel, type ConfigSnapshot } from './config-panel';

export const dynamic = 'force-dynamic';

export default async function DeveloperConfigPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/developer/config');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/developer');
  if (!user.permissions.includes('dev:logs:view')) redirect('/perfil');

  const res = await devFetch<ConfigSnapshot>('/config', { accessToken: session.accessToken });
  const snapshot = res.ok ? (res.data as ConfigSnapshot) : null;
  const error = !res.ok
    ? (res.data as { message?: string })?.message ?? 'Falha ao carregar'
    : null;

  return (
    <AppShell
      pathname="/admin/developer/config"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Developer', href: '/admin/developer' },
        { label: 'Configurações' },
      ]}
    >
      <ConfigPanel snapshot={snapshot} error={error} />
    </AppShell>
  );
}
