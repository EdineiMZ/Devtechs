import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';

import { EmployeeForm } from './_components/employee-form';

export const dynamic = 'force-dynamic';

export default async function NewEmployeePage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/rh/funcionarios/novo');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/rh');
  if (!user.permissions.includes('rh:employees:edit')) redirect('/perfil');

  return (
    <AppShell
      pathname="/admin/rh"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'RH', href: '/admin/rh' },
        { label: 'Funcionários', href: '/admin/rh/funcionarios' },
        { label: 'Novo funcionário' },
      ]}
    >
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          Recursos Humanos
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
          Novo funcionário
        </h1>
      </header>

      <EmployeeForm accessToken={session.accessToken!} />
    </AppShell>
  );
}
