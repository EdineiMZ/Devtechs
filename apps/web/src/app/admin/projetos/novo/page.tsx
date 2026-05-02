import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listUsers } from '@/lib/auth-admin-api';

import { NewProjectForm } from './new-project-form';

export const dynamic = 'force-dynamic';

export default async function NovoProjetoPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/projetos/novo');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/projetos');
  if (!user.permissions.includes('projects:create')) redirect('/admin/projetos');

  const usersRes = await listUsers({ pageSize: 200 }).catch(() => ({ ok: false, data: { items: [] } }));
  const users = usersRes.ok
    ? ((usersRes.data as { items: Array<{ id: string; name: string; email: string }> }).items ?? [])
    : [];

  return (
    <AppShell
      pathname="/admin/projetos"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Projetos', href: '/admin/projetos' },
        { label: 'Novo projeto' },
      ]}
    >
      <NewProjectForm
        currentUserId={user.id}
        users={users}
        accessToken={session.accessToken}
      />
    </AppShell>
  );
}
