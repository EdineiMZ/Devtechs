import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listBillingProducts } from '@/lib/recurring-billing-api';
import type { BillingProduct } from '@/lib/recurring-billing-api';

import { ProductsClient } from './_components/products-client';

export const dynamic = 'force-dynamic';

export default async function ProdutosPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/financeiro/produtos');
  const user = session.user;
  if (!session.accessToken) redirect('/login');
  if (!user.permissions.includes('finance:products:view')) redirect('/perfil');

  const res = await listBillingProducts();
  const products: BillingProduct[] = res.ok ? (res.data as BillingProduct[]) : [];

  return (
    <AppShell
      pathname="/admin/financeiro/produtos"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Financeiro', href: '/admin/financeiro' },
        { label: 'Produtos & Serviços' },
      ]}
    >
      <ProductsClient
        products={products}
        accessToken={session.accessToken}
        canManage={user.permissions.includes('finance:products:manage')}
      />
    </AppShell>
  );
}
