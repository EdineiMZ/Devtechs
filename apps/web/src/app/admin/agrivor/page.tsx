import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';

import { AgrivorPanel } from './_components/agrivor-panel';

export const dynamic = 'force-dynamic';

export default async function AgrivorAdminPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/agrivor');
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/agrivor');

  if (!session.user.permissions.includes('agrivor:admin:view')) {
    redirect('/perfil');
  }

  return (
    <AppShell
      pathname="/admin/agrivor"
      navItems={ADMIN_NAV_ITEMS}
      permissions={session.user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'AGRIVOR' },
      ]}
    >
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-foreground">AGRIVOR</h1>
        <p className="mt-1 text-sm text-ash">
          Gerencie chaves de acesso, pagamentos e telemetria do produto AGRIVOR.
        </p>
      </div>
      <AgrivorPanel />
    </AppShell>
  );
}
