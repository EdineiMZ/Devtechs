import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { getNotificationPreferences } from '@/lib/notifications-api';
import type { NotificationPreferences } from '@/lib/notifications-api';

import { NotificationPrefsForm } from './_components/notification-prefs-form';

export const dynamic = 'force-dynamic';

export default async function NotificacoesPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.accessToken || !session.user) {
    redirect('/login?callbackUrl=/perfil/configuracoes/notificacoes');
  }

  const res = await getNotificationPreferences(session.accessToken);
  const prefs: NotificationPreferences = res.ok && res.data && !('message' in res.data)
    ? (res.data as NotificationPreferences)
    : {
        email: {
          invoice: true, login: false, accountChange: true,
          support: true,  rh: true,    system: true, subscription: true,
        },
        inapp: {
          invoice: true, login: true,  accountChange: true,
          support: true,  rh: true,    system: true, subscription: true,
        },
      };

  return (
    <section className="max-w-2xl">
      <header className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Preferências de Notificação</h2>
        <p className="mt-1 text-sm text-ash">
          Escolha quais eventos geram notificações no app e quais também enviam e-mail.
        </p>
      </header>
      <NotificationPrefsForm
        initial={prefs}
        accessToken={session.accessToken}
      />
    </section>
  );
}
