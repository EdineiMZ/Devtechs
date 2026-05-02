import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listUsers } from '@/lib/auth-admin-api';
import { devFetch } from '@/lib/developer-api';
import { listProjects } from '@/lib/projects-api';

import { AttachVpsDialog } from './_components/attach-vps-dialog';
import { VpsList, type VpsListItem } from './vps-list';

export const dynamic = 'force-dynamic';

/**
 * /admin/developer/vps — admin console for the Hostinger VPS module.
 *
 * Server-rendered list grouped by client. The live state (running /
 * stopped) comes from each VM's upstream Hostinger record, joined
 * server-side by `developer-service /vps`.
 *
 * Permission gate: `dev:vps:manage`. Users without it are pushed back
 * to /perfil — the matching menu item already hides for them, but the
 * page guards itself in case someone hits the URL directly.
 */
export default async function VpsAdminPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/developer/vps');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/developer');
  if (!user.permissions.includes('dev:vps:manage')) redirect('/perfil');

  const [vpsRes, usersRes, projectsRes] = await Promise.all([
    devFetch<VpsListItem[]>('/vps', { accessToken: session.accessToken }),
    listUsers({ pageSize: 200 }).catch(() => ({ ok: false, data: { items: [] } })),
    listProjects({ pageSize: 200 }).catch(() => ({ ok: false, data: { items: [] } })),
  ]);

  const vpsList: VpsListItem[] = vpsRes.ok && Array.isArray(vpsRes.data) ? (vpsRes.data as VpsListItem[]) : [];
  const error = !vpsRes.ok
    ? (vpsRes.data as { message?: string })?.message ?? 'Falha ao carregar VPSs'
    : null;
  const clients = usersRes.ok
    ? ((usersRes.data as { items: Array<{ id: string; name: string; email: string }> }).items ?? [])
    : [];
  const projects = projectsRes.ok
    ? ((projectsRes.data as { items: Array<{ id: string; name: string }> }).items ?? [])
    : [];

  return (
    <AppShell
      pathname="/admin/developer/vps"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Developer', href: '/admin/developer' },
        { label: 'VPS' },
      ]}
    >
      <div className="mb-4 flex justify-end">
        <AttachVpsDialog
          accessToken={session.accessToken}
          clients={clients}
          projects={projects}
        />
      </div>
      <VpsList initial={vpsList} error={error} />
    </AppShell>
  );
}
