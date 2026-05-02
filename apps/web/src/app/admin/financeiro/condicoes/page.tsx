import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listPaymentConditions } from '@/lib/finance-api';

import { CondicoesClient } from './_components/condicoes-client';

export const dynamic = 'force-dynamic';

export default async function CondicoesPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/financeiro');

  const res = await listPaymentConditions(false);
  const conditions = res.ok && Array.isArray(res.data) ? res.data : [];

  return (
    <AppShell
      pathname="/admin/financeiro/condicoes"
      navItems={ADMIN_NAV_ITEMS}
      permissions={session.user.permissions}
      breadcrumbs={[
        { label: 'Financeiro', href: '/admin/financeiro' },
        { label: 'Condições de Pagamento' },
      ]}
    >
      <CondicoesClient
        conditions={conditions}
        accessToken={session.accessToken}
      />
    </AppShell>
  );
}
