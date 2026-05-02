import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listUsers } from '@/lib/auth-admin-api';
import { listInvoices } from '@/lib/finance-api';
import type { Invoice } from '@/lib/finance-api';
import { listProjects } from '@/lib/projects-api';

import { FaturasClient } from './_components/faturas-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
}

export default async function FaturasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/financeiro/faturas');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/financeiro');
  if (!user.permissions.includes('finance:invoices:issue')) redirect('/perfil');

  const [invoicesRes, projectsRes, usersRes] = await Promise.all([
    listInvoices({ status: searchParams.status as Invoice['status'] | undefined }),
    listProjects({ pageSize: 200 }).catch(() => ({ ok: false, data: { items: [] } })),
    listUsers({ pageSize: 200 }).catch(() => ({ ok: false, data: { items: [] } })),
  ]);

  const invoices: Invoice[] = invoicesRes.ok ? (invoicesRes.data as Invoice[]) : [];
  const projects = projectsRes.ok
    ? ((projectsRes.data as { items: Array<{ id: string; name: string }> }).items ?? [])
    : [];
  const users = usersRes.ok
    ? ((usersRes.data as { items: Array<{ id: string; name: string; email: string }> }).items ?? [])
    : [];

  return (
    <AppShell
      pathname="/admin/financeiro"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Financeiro', href: '/admin/financeiro' },
        { label: 'Faturas' },
      ]}
    >
      <FaturasClient
        invoices={invoices}
        projects={projects}
        users={users}
        accessToken={session.accessToken}
        currentStatus={searchParams.status}
      />
    </AppShell>
  );
}
