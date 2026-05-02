import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { type AuditLogItem, getUserTimeline } from '@/lib/audit-api';

import { UserActivityView } from './user-activity-view';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export default async function UserActivityPage({ params }: Props): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/admin/usuarios/${params.id}/atividade`);
  }
  const user = session.user;
  if (!user.permissions.includes('dev:logs:view')) redirect('/perfil');

  const res = await getUserTimeline(params.id);
  const timeline: AuditLogItem[] = res.ok && Array.isArray(res.data) ? (res.data as AuditLogItem[]) : [];
  const error =
    !res.ok ? (res.data as { message?: string })?.message ?? 'Falha ao carregar timeline' : null;

  return (
    <AppShell
      pathname={`/admin/usuarios/${params.id}/atividade`}
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Auditoria', href: '/admin/auditoria' },
        { label: `Usuário ${params.id.slice(0, 8)}…` },
      ]}
    >
      <UserActivityView userId={params.id} timeline={timeline} error={error} />
    </AppShell>
  );
}
