import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { getRecurringSubscription } from '@/lib/recurring-billing-api';
import type { RecurringSubscription } from '@/lib/recurring-billing-api';

import { SubscriptionDetailClient } from './_components/subscription-detail-client';

export const dynamic = 'force-dynamic';

export default async function AssinaturaDetailPage({
  params,
}: {
  params: { id: string };
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const user = session.user;
  if (!session.accessToken) redirect('/login');
  if (!user.permissions.includes('finance:subscriptions:view')) redirect('/perfil');

  const res = await getRecurringSubscription(params.id);
  const sub: RecurringSubscription | null = res.ok ? (res.data as RecurringSubscription) : null;

  return (
    <AppShell
      pathname="/admin/financeiro"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Financeiro', href: '/admin/financeiro' },
        { label: 'Assinaturas', href: '/admin/financeiro/assinaturas' },
        { label: sub?.name ?? 'Detalhes' },
      ]}
    >
      {!sub ? (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Assinatura não encontrada.
        </div>
      ) : (
        <SubscriptionDetailClient
          subscription={sub}
          accessToken={session.accessToken}
          canManage={user.permissions.includes('finance:subscriptions:manage')}
          canCancel={user.permissions.includes('finance:subscriptions:cancel')}
        />
      )}
    </AppShell>
  );
}
