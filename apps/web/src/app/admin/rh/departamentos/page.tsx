import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listDepartments } from '@/lib/rh-api';
import type { DepartmentItem } from '@/lib/rh-api';

import { DepartamentosManager } from './_components/departamentos-manager';

export const dynamic = 'force-dynamic';

export default async function DepartamentosPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/rh/departamentos');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/rh/departamentos');
  if (!user.permissions.includes('rh:employees:view')) redirect('/perfil');

  const res = await listDepartments(session.accessToken);
  const departments: DepartmentItem[] = res.ok ? (res.data as DepartmentItem[]) : [];
  const canEdit = user.permissions.includes('rh:employees:edit');

  return (
    <AppShell
      pathname="/admin/rh"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'RH', href: '/admin/rh' },
        { label: 'Departamentos' },
      ]}
    >
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          Recursos Humanos
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
          Departamentos
        </h1>
        <p className="mt-1 text-sm text-ash">
          {departments.length} departamento{departments.length !== 1 ? 's' : ''} cadastrado{departments.length !== 1 ? 's' : ''}
        </p>
      </header>

      <DepartamentosManager
        initial={departments}
        canEdit={canEdit}
        accessToken={session.accessToken!}
      />
    </AppShell>
  );
}
