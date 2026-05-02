import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { ProfileForm } from '@/components/account/profile-form';
import { getProfile } from '@/lib/account-api';

export const dynamic = 'force-dynamic';

export default async function ProfilePage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.accessToken || !session.user) {
    redirect('/login?callbackUrl=/perfil/configuracoes');
  }

  const res = await getProfile(session.accessToken);
  // If the auth-service is offline or the call 401s, fall back to
  // what the session JWT carries — at minimum we have name/email.
  const profile = res.ok
    ? (res.data as {
        id: string;
        email: string;
        name: string;
        avatarUrl: string | null;
        emailVerified: boolean;
      })
    : {
        id: session.user.id,
        email: session.user.email ?? '',
        name: session.user.name ?? '',
        avatarUrl: null,
        emailVerified: Boolean(session.user.emailVerified),
      };

  return (
    <section className="max-w-2xl">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          Dados pessoais
        </h2>
        <p className="mt-1 text-sm text-ash">
          Estas informações aparecem para outros usuários quando você comenta em
          tickets, abre chamados, etc.
        </p>
      </header>
      <ProfileForm
        initial={{
          name: profile.name,
          email: profile.email,
          avatarUrl: profile.avatarUrl,
        }}
        emailVerified={profile.emailVerified}
      />
    </section>
  );
}
