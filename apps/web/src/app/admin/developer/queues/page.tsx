import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { devFetch } from '@/lib/developer-api';

import { QueuesTable, type QueueSummary } from './queues-table';

export const dynamic = 'force-dynamic';

export default async function DeveloperQueuesPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/developer/queues');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/developer');
  if (!user.permissions.includes('dev:logs:view')) redirect('/perfil');

  const res = await devFetch<QueueSummary[]>('/queues', { accessToken: session.accessToken });
  const queues = res.ok && Array.isArray(res.data)
    ? (res.data as QueueSummary[])
    : [];
  const error = !res.ok
    ? (res.data as { message?: string })?.message ?? 'Falha ao carregar'
    : null;

  return (
    <AppShell
      pathname="/admin/developer/queues"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Developer', href: '/admin/developer' },
        { label: 'Filas' },
      ]}
    >
      <QueuesTable initial={queues} error={error} />
    </AppShell>
  );
}
