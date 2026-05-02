import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';

export const dynamic = 'force-dynamic';

export default async function EscalasPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/rh/escalas');
  const user = session.user;
  if (!user.permissions.includes('rh:employees:view')) redirect('/perfil');

  return (
    <AppShell
      pathname="/admin/rh"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'RH', href: '/admin/rh' },
        { label: 'Escalas' },
      ]}
    >
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          Recursos Humanos
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
          Escalas
        </h1>
        <p className="mt-1 text-sm text-ash">Horários e turnos dos colaboradores</p>
      </header>

      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-20 text-center">
        <p className="text-sm font-medium text-foreground">Em desenvolvimento</p>
        <p className="mt-1 text-xs text-ash">
          O módulo de escalas e turnos estará disponível em breve.
        </p>
      </div>
    </AppShell>
  );
}
