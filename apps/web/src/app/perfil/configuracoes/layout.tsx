import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { CLIENT_NAV_ITEMS } from '@/components/app/nav-config';
import { SettingsTabs } from '@/components/app/settings-tabs';

/**
 * Server-component layout for `/perfil/configuracoes/*`.
 *
 * Validates the session, renders the standard `AppShell` (sidebar +
 * topbar + breadcrumbs) and a tab strip that links to the three
 * sub-pages: Perfil, Segurança e 2FA. Each child page is responsible
 * for its own data fetch + form state.
 */
export default async function ConfiguracoesLayout({
  children,
}: {
  children: ReactNode;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) {
    redirect('/login?callbackUrl=/perfil/configuracoes');
  }

  return (
    <AppShell
      pathname="/perfil/configuracoes"
      navItems={CLIENT_NAV_ITEMS}
      permissions={session.user.permissions}
      breadcrumbs={[
        { label: 'Minha conta', href: '/perfil' },
        { label: 'Configurações' },
      ]}
    >
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Configurações da conta
        </h1>
        <p className="mt-1 text-sm text-ash">
          Gerencie seus dados pessoais, senha, sessões ativas, autenticação em
          duas etapas e preferências de notificação.
        </p>
      </header>

      <SettingsTabs />

      <div className="pt-2">{children}</div>
    </AppShell>
  );
}
