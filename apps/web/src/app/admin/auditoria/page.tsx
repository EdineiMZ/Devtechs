import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import {
  type AuditCursorPage,
  type AuditStats,
  getAuditStats,
  listAuditLogs,
} from '@/lib/audit-api';

import { AuditPanel } from './audit-panel';

export const dynamic = 'force-dynamic';

const DEFAULT_LOOKBACK_DAYS = 7;

export default async function AuditoriaPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/auditoria');
  const user = session.user;
  if (!user.permissions.includes('dev:logs:view')) redirect('/perfil');

  const dateTo = new Date();
  const dateFrom = new Date(dateTo.getTime() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const [logsRes, statsRes] = await Promise.all([
    listAuditLogs({
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
      pageSize: 50,
    }),
    getAuditStats(),
  ]);

  const initialPage: AuditCursorPage =
    logsRes.ok && 'items' in (logsRes.data as object)
      ? (logsRes.data as AuditCursorPage)
      : { items: [], nextCursor: null, pageSize: 50 };
  const stats: AuditStats =
    statsRes.ok && 'topActions' in (statsRes.data as object)
      ? (statsRes.data as AuditStats)
      : { topActions: [], topUsers: [], modulesWithErrors: [], loginsByHour: [] };

  const error = !logsRes.ok
    ? (logsRes.data as { message?: string })?.message ?? 'Falha ao carregar logs'
    : null;

  return (
    <AppShell
      pathname="/admin/auditoria"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Auditoria' }]}
    >
      <AuditPanel
        initialPage={initialPage}
        initialStats={stats}
        defaultDateFrom={dateFrom.toISOString()}
        defaultDateTo={dateTo.toISOString()}
        canViewSecurity={user.permissions.includes('dev:config:edit')}
        error={error}
      />
    </AppShell>
  );
}
