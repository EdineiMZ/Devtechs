import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';

import { TransactionForm } from './_components/transaction-form';

export const dynamic = 'force-dynamic';

export default async function NewTransactionPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/financeiro/transacoes/nova');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/financeiro');
  if (!user.permissions.includes('finance:accounts:edit')) redirect('/perfil');

  return (
    <AppShell
      pathname="/admin/financeiro"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Financeiro', href: '/admin/financeiro' },
        { label: 'Transações', href: '/admin/financeiro/transacoes' },
        { label: 'Novo lançamento' },
      ]}
    >
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">Financeiro</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
          Novo lançamento
        </h1>
      </header>

      <TransactionForm accessToken={session.accessToken!} />
    </AppShell>
  );
}
