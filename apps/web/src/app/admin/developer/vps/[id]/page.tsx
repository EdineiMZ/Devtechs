import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { devFetch } from '@/lib/developer-api';

import type { VpsListItem } from '../vps-list';
import { VpsDetailView, type HostingerMetricsResponse } from './vps-detail-view';

export const dynamic = 'force-dynamic';

interface VpsDetailResponse {
  vps: VpsListItem;
  metrics: HostingerMetricsResponse | null;
}

interface PageProps {
  params: { id: string };
}

export default async function VpsDetailPage({ params }: PageProps): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/admin/developer/vps/${params.id}`);
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/developer');
  if (!user.permissions.includes('dev:vps:manage')) redirect('/perfil');

  const res = await devFetch<VpsDetailResponse>(`/vps/${params.id}`, { accessToken: session.accessToken });
  if (!res.ok) {
    const status = (res as { status?: number }).status;
    if (status === 404) notFound();
  }
  const detail = res.ok ? (res.data as VpsDetailResponse) : null;
  const error =
    !res.ok ? (res.data as { message?: string })?.message ?? 'Falha ao carregar detalhes' : null;

  return (
    <AppShell
      pathname={`/admin/developer/vps/${params.id}`}
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Developer', href: '/admin/developer' },
        { label: 'VPS', href: '/admin/developer/vps' },
        { label: detail?.vps.label ?? 'Detalhe' },
      ]}
    >
      <VpsDetailView id={params.id} initial={detail} error={error} />
    </AppShell>
  );
}
