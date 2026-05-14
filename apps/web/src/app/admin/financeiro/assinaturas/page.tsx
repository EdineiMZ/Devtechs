import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listRecurringSubscriptions } from '@/lib/recurring-billing-api';
import type { RecurringSubscription } from '@/lib/recurring-billing-api';
import { listInvoiceClients } from '@/lib/finance-api';
import type { InvoiceClient } from '@/lib/finance-api';

import { SubscriptionsClient } from './_components/subscriptions-client';

export const dynamic = 'force-dynamic';

export default async function AssinaturasPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/financeiro/assinaturas');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/financeiro/assinaturas');
  if (!user.permissions.includes('finance:reports:view')) redirect('/perfil');

  const [subsRes, clientsRes] = await Promise.all([
    listRecurringSubscriptions(),
    listInvoiceClients().catch(() => ({ ok: false, data: [] })),
  ]);

  const subscriptions: RecurringSubscription[] = subsRes.ok
    ? (subsRes.data as RecurringSubscription[])
    : [];
  const clients: InvoiceClient[] = clientsRes.ok ? (clientsRes.data as InvoiceClient[]) : [];

  return (
    <AppShell
      pathname="/admin/financeiro"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Financeiro', href: '/admin/financeiro' },
        { label: 'Assinaturas Recorrentes' },
      ]}
    >
      <SubscriptionsClient
        subscriptions={subscriptions}
        clients={clients}
        accessToken={session.accessToken}
        canManage={user.permissions.includes('finance:invoices:issue')}
      />
    </AppShell>
  );
}
