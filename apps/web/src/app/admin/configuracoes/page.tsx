import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';

export const dynamic = 'force-dynamic';

const SECTIONS = [
  {
    href: '/admin/configuracoes/usuarios',
    title: 'Usuários',
    description: 'Gerencie contas, status e papéis dos usuários da plataforma.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
    permission: 'dev:config:edit',
  },
  {
    href: '/admin/configuracoes/papeis',
    title: 'Papéis',
    description: 'Crie e configure os papéis de acesso (roles) e suas permissões.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    permission: 'dev:config:edit',
  },
  {
    href: '/admin/configuracoes/permissoes',
    title: 'Permissões',
    description: 'Visualize todas as permissões disponíveis na plataforma por módulo.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33" />
      </svg>
    ),
    permission: 'dev:config:view',
  },
  {
    href: '/admin/configuracoes/empresa',
    title: 'Empresa',
    description: 'Configure nome, logo e dados gerais da organização.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
    permission: 'dev:config:edit',
  },
  {
    href: '/admin/configuracoes/auditoria',
    title: 'Auditoria',
    description: 'Logs de ações administrativas e alterações na plataforma.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    permission: 'dev:config:view',
  },
] as const;

export default async function ConfiguracoesPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/configuracoes');

  const { user } = session;
  const canView = user.permissions.includes('dev:config:view') || user.permissions.includes('dev:config:edit');
  if (!canView) redirect('/perfil');

  return (
    <AppShell
      pathname="/admin/configuracoes"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Configurações' },
      ]}
    >
      {/* Header */}
      <header className="mb-8">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-copper">
          // configurações
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">
          Configurações
        </h1>
        <p className="mt-1 font-body text-sm text-ash">
          Usuários, papéis, permissões e dados da plataforma
        </p>
      </header>

      {/* Cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.filter((s) => user.permissions.includes(s.permission)).map((section) => (
          <a
            key={section.href}
            href={section.href}
            className="group flex flex-col gap-4 rounded-xl border border-white/8 bg-white/[0.02] p-6 transition-colors hover:border-copper/30 hover:bg-white/[0.04]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-ash transition-colors group-hover:border-copper/20 group-hover:text-copper">
              {section.icon}
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-foreground">
                {section.title}
              </p>
              <p className="mt-1 font-body text-xs leading-relaxed text-ash">
                {section.description}
              </p>
            </div>
            <div className="mt-auto flex items-center gap-1 font-mono text-[10px] text-ash/50 transition-colors group-hover:text-copper/70">
              <span>Acessar</span>
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                <path fillRule="evenodd" d="M2 8a.75.75 0 01.75-.75h8.69L8.22 4.03a.75.75 0 011.06-1.06l4.5 4.5a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 01-1.06-1.06l3.22-3.22H2.75A.75.75 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
          </a>
        ))}
      </div>
    </AppShell>
  );
}
