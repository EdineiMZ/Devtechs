import { redirect } from 'next/navigation';
import { Shield } from 'lucide-react';

import { auth } from '@/auth';

import { PrivacidadePanel } from './_components/privacidade-panel';

export const dynamic = 'force-dynamic';

export default async function PrivacidadePage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.accessToken || !session.user) {
    redirect('/login?callbackUrl=/perfil/configuracoes/privacidade');
  }

  return (
    <section className="max-w-2xl space-y-8">
      <header className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-4 w-4 text-copper" />
          <h2 className="text-lg font-semibold text-foreground">Privacidade & LGPD</h2>
        </div>
        <p className="text-sm text-ash">
          Seus direitos como titular de dados (LGPD art. 18). Exporte seus dados, gerencie
          consentimentos ou encerre sua conta permanentemente.
        </p>
      </header>

      <PrivacidadePanel accessToken={session.accessToken} userEmail={session.user.email ?? ''} />
    </section>
  );
}
