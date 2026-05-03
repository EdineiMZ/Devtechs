import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { getCompanySettings } from '@/lib/auth-admin-api';
import type { CompanySettings } from '@/lib/auth-admin-api';

import { CompanySettingsForm } from './_components/company-settings-form';

export const dynamic = 'force-dynamic';

export default async function EmpresaPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/configuracoes/empresa');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/configuracoes');
  if (!user.permissions.includes('dev:config:edit')) redirect('/perfil');

  const res = await getCompanySettings(session.accessToken);
  const settings: CompanySettings | null = res.ok ? (res.data as CompanySettings) : null;

  return (
    <AppShell
      pathname="/admin/configuracoes"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Configurações', href: '/admin/configuracoes' },
        { label: 'Empresa' },
      ]}
    >
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">
          Configurações
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
          Dados da empresa
        </h1>
        <p className="mt-1 text-sm text-ash">
          Informações legais, endereço, CNPJ e configurações de faturamento
        </p>
      </header>

      <CompanySettingsForm initial={settings} accessToken={session.accessToken!} />
    </AppShell>
  );
}
