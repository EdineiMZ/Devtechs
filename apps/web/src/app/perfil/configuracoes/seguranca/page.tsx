import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { ChangePasswordForm } from '@/components/account/change-password-form';
import { SessionsList } from '@/components/account/sessions-list';
import { listSessions, type AccountSession } from '@/lib/account-api';

export const dynamic = 'force-dynamic';

export default async function SecurityPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.accessToken) {
    redirect('/login?callbackUrl=/perfil/configuracoes/seguranca');
  }

  const res = await listSessions(session.accessToken);
  let sessions: AccountSession[] = [];
  let sessionsError: string | null = null;
  if (res.ok) {
    sessions = res.data as AccountSession[];
  } else {
    sessionsError =
      'Não foi possível carregar as sessões ativas. Tente novamente em instantes.';
  }

  return (
    <div className="space-y-8">
      <section className="max-w-2xl">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Trocar senha
          </h2>
          <p className="mt-1 text-sm text-ash">
            Após a troca, todas as outras sessões ativas serão encerradas e
            você precisará fazer login novamente neste navegador.
          </p>
        </header>
        <ChangePasswordForm />
      </section>

      <section>
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Sessões ativas
          </h2>
          <p className="mt-1 text-sm text-ash">
            Estes são os dispositivos que estão logados na sua conta agora.
            Encerre os que não reconhecer.
          </p>
        </header>
        {sessionsError ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {sessionsError}
          </div>
        ) : (
          <SessionsList initialSessions={sessions} />
        )}
      </section>
    </div>
  );
}
