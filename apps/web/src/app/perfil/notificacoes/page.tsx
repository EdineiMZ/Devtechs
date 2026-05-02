import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { CLIENT_NAV_ITEMS } from '@/components/app/nav-config';
import {
  listNotifications,
  type NotificationListResponse,
} from '@/lib/notifications-api';

import { NotificationsFeed } from './notifications-feed';

export const dynamic = 'force-dynamic';

export default async function NotificacoesPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/perfil/notificacoes');
  const user = session.user;

  const res = await listNotifications({ pageSize: 100 });
  const list = res.ok
    ? (res.data as NotificationListResponse)
    : { items: [], total: 0, totalPages: 0, page: 1, pageSize: 100, unreadCount: 0 };

  const errorMessage = !res.ok
    ? 'Não foi possível carregar suas notificações no momento. Tente novamente em instantes.'
    : null;

  return (
    <AppShell
      pathname="/perfil/notificacoes"
      navItems={CLIENT_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Minha conta', href: '/perfil' },
        { label: 'Notificações' },
      ]}
    >
      <NotificationsFeed
        initialNotifications={list.items}
        initialUnreadCount={list.unreadCount}
        accessToken={session.accessToken}
        error={errorMessage}
      />
    </AppShell>
  );
}
