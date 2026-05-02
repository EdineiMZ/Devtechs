import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listRoles, listPermissions } from '@/lib/auth-admin-api';
import type { PermissionsByModuleResponse, RoleResponse } from '@/lib/auth-admin-api';

import { PapeisManager } from './_components/papeis-manager';

export const dynamic = 'force-dynamic';

export default async function PapeisPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/configuracoes/papeis');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/configuracoes');
  if (!user.permissions.includes('dev:config:edit')) redirect('/perfil');

  const [rolesRes, permsRes] = await Promise.all([listRoles(), listPermissions()]);

  const roles: RoleResponse[] = rolesRes.ok ? (rolesRes.data as RoleResponse[]) : [];
  const permsByModule: PermissionsByModuleResponse = permsRes.ok
    ? (permsRes.data as PermissionsByModuleResponse)
    : {};

  return (
    <AppShell
      pathname="/admin/configuracoes"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Configurações', href: '/admin/configuracoes' },
        { label: 'Papéis' },
      ]}
    >
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">
          Configurações
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
          Papéis (Roles)
        </h1>
        <p className="mt-1 text-sm text-ash">{roles.length} papéis cadastrados</p>
      </header>

      <PapeisManager
        initial={roles}
        permsByModule={permsByModule}
        accessToken={session.accessToken!}
      />
    </AppShell>
  );
}
