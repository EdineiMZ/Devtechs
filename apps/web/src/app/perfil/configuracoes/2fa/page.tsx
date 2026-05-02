import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { TwoFactorPanel } from '@/components/account/two-factor-panel';
import { getProfile } from '@/lib/account-api';

export const dynamic = 'force-dynamic';

export default async function TwoFactorPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.accessToken) {
    redirect('/login?callbackUrl=/perfil/configuracoes/2fa');
  }

  // We need the live `twoFactorEnabled` flag from auth-service — the
  // session JWT doesn't carry it (only the login response does, and
  // the user might have just toggled it from another device).
  const res = await getProfile(session.accessToken);
  const enabled =
    res.ok && Boolean((res.data as { twoFactorEnabled?: boolean }).twoFactorEnabled);

  return (
    <section className="max-w-2xl">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          Autenticação em duas etapas
        </h2>
        <p className="mt-1 text-sm text-ash">
          Adicione uma camada extra de segurança exigindo um código de 6 dígitos
          do seu app autenticador (Google Authenticator, 1Password, Authy…) a
          cada login.
        </p>
      </header>
      <TwoFactorPanel initiallyEnabled={enabled} />
    </section>
  );
}
