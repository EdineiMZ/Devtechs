import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listBillingProducts } from '@/lib/recurring-billing-api';
import type { BillingProduct } from '@/lib/recurring-billing-api';
import { listUsers } from '@/lib/auth-admin-api';
import type { UserAdminItem } from '@/lib/auth-admin-api';

import { NovaAssinaturaClient } from './_components/nova-client';

export const dynamic = 'force-dynamic';

export default async function NovaAssinaturaPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/financeiro/assinaturas/nova');
  const user = session.user;
  if (!session.accessToken) redirect('/login');
  if (!user.permissions.includes('finance:subscriptions:manage')) redirect('/perfil');

  const [usersRes, productsRes] = await Promise.all([
    listUsers({ pageSize: 200 }).catch(() => ({ ok: false as const, data: { items: [], page: 1, pageSize: 200, total: 0, totalPages: 0 } })),
    listBillingProducts({ activeOnly: true }).catch(() => ({ ok: false as const, data: [] })),
  ]);

  const users: UserAdminItem[] = usersRes.ok
    ? (usersRes.data as { items: UserAdminItem[] }).items
    : [];
  const products: BillingProduct[] = productsRes.ok
    ? (productsRes.data as BillingProduct[])
    : [];

  return (
    <AppShell
      pathname="/admin/financeiro/assinaturas"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Financeiro', href: '/admin/financeiro' },
        { label: 'Assinaturas Recorrentes', href: '/admin/financeiro/assinaturas' },
        { label: 'Nova' },
      ]}
    >
      <NovaAssinaturaClient
        users={users}
        products={products}
        accessToken={session.accessToken}
      />
    </AppShell>
  );
}
