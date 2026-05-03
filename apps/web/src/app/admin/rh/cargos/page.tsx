import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listPositions } from '@/lib/rh-api';
import type { PositionItem } from '@/lib/rh-api';

import { CargosManager } from './_components/cargos-manager';

export const dynamic = 'force-dynamic';

const LEVEL_LABELS: Record<string, string> = {
  JUNIOR: 'Júnior',
  MID: 'Pleno',
  SENIOR: 'Sênior',
  LEAD: 'Líder',
  MANAGER: 'Gerente',
  DIRECTOR: 'Diretor',
};

export default async function CargosPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/rh/cargos');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/rh/cargos');
  if (!user.permissions.includes('rh:employees:view')) redirect('/perfil');

  const res = await listPositions(session.accessToken);
  const positions: PositionItem[] = res.ok ? (res.data as PositionItem[]) : [];

  const canEdit = user.permissions.includes('rh:employees:edit');

  return (
    <AppShell
      pathname="/admin/rh"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'RH', href: '/admin/rh' },
        { label: 'Cargos' },
      ]}
    >
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          Recursos Humanos
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
          Cargos
        </h1>
        <p className="mt-1 text-sm text-ash">
          {positions.length} cargo{positions.length !== 1 ? 's' : ''} cadastrado{positions.length !== 1 ? 's' : ''}
        </p>
      </header>

      <CargosManager
        initial={positions}
        canEdit={canEdit}
        accessToken={session.accessToken!}
        levelLabels={LEVEL_LABELS}
      />
    </AppShell>
  );
}
