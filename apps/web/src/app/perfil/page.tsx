import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Badge } from '@devtechs/ui';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { Icon } from '@/components/app/icons';
import { CLIENT_NAV_ITEMS } from '@/components/app/nav-config';
import { StatCard } from '@/components/app/stat-card';

/**
 * Client dashboard — the authenticated landing for non-admin
 * users. Shows a friendly "hello" hero, the three key
 * indicators (open tickets, outstanding invoices, unread
 * notifications) and quick-action cards linking to the core
 * self-service flows.
 */
export const dynamic = 'force-dynamic';

export default async function PerfilPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) {
    redirect('/login?callbackUrl=/perfil');
  }
  const user = session.user;

  return (
    <AppShell
      pathname="/perfil"
      navItems={CLIENT_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[{ label: 'Minha conta' }, { label: 'Visão geral' }]}
    >
      {/* Hero */}
      <section className="relative mb-8 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(160,84%,39%,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(217,91%,60%,0.1),transparent_50%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Portal do cliente
            </div>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-white">
              Olá,{' '}
              <span className="bg-gradient-to-r from-emerald-300 to-sky-300 bg-clip-text text-transparent">
                {user.name?.split(' ')[0] ?? user.email}
              </span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              Aqui você acompanha seus chamados, faturas e notificações em um
              só lugar. Nossa equipe responde em até 24 horas úteis.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {user.emailVerified ? (
              <Badge variant="success">Email verificado</Badge>
            ) : (
              <Badge variant="warning">Email não verificado</Badge>
            )}
            <Badge variant="default">{user.mainRole ?? 'cliente'}</Badge>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="mb-10">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Indicadores
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Tickets abertos"
            value={0}
            hint="nenhum chamado em andamento"
            accent="sky"
            icon={Icon.ticket}
          />
          <StatCard
            label="Faturas a vencer"
            value="R$ 0"
            hint="sem cobranças pendentes"
            accent="emerald"
            icon={Icon.dollar}
          />
          <StatCard
            label="Notificações"
            value={0}
            hint="tudo em dia"
            accent="violet"
            icon={Icon.alert}
          />
        </div>
      </section>

      {/* Quick actions */}
      <section className="mb-10 grid gap-4 lg:grid-cols-3">
        <QuickAction
          title="Abrir ticket"
          description="Precisa de ajuda? Registre um chamado para nossa equipe de suporte."
          href="/perfil/tickets/novo"
          accent="sky"
          icon={Icon.ticket}
        />
        <QuickAction
          title="Ver faturas"
          description="Consulte notas fiscais, baixe PDFs e acompanhe vencimentos."
          href="/perfil/faturas"
          accent="emerald"
          icon={Icon.dollar}
        />
        <QuickAction
          title="Central de contato"
          description="Converse com nosso atendimento — resposta em até 24h úteis."
          href="/contato"
          accent="violet"
          icon={Icon.users}
        />
      </section>

      {/* Account info */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30">
              <span className="h-5 w-5">{Icon.shield}</span>
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Dados da conta
              </h2>
              <p className="text-xs text-muted-foreground">
                Mantenha seu cadastro atualizado
              </p>
            </div>
          </div>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-xs text-muted-foreground">Nome</dt>
              <dd className="text-sm font-medium text-foreground">
                {user.name ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="text-sm font-medium text-foreground">
                {user.email}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs text-muted-foreground">Role</dt>
              <dd className="text-sm font-medium text-foreground">
                {user.mainRole ?? 'member'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
              <span className="h-5 w-5">{Icon.check}</span>
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Acessos ativos
              </h2>
              <p className="text-xs text-muted-foreground">
                {user.permissions.length} permissões concedidas
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {user.permissions.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                Sem permissões extras. Usando o conjunto padrão do seu role.
              </span>
            ) : (
              user.permissions.slice(0, 24).map((perm) => (
                <code
                  key={perm}
                  className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                >
                  {perm}
                </code>
              ))
            )}
            {user.permissions.length > 24 ? (
              <span className="text-[10px] text-muted-foreground">
                +{user.permissions.length - 24} ocultas
              </span>
            ) : null}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

interface QuickActionProps {
  title: string;
  description: string;
  href: string;
  accent: 'sky' | 'emerald' | 'violet';
  icon: JSX.Element;
}

function QuickAction({
  title,
  description,
  href,
  accent,
  icon,
}: QuickActionProps): JSX.Element {
  const ring = {
    sky: 'hover:ring-sky-500/40 hover:shadow-[0_0_30px_hsl(217,91%,60%,0.15)]',
    emerald:
      'hover:ring-emerald-500/40 hover:shadow-[0_0_30px_hsl(160,84%,39%,0.15)]',
    violet:
      'hover:ring-violet-500/40 hover:shadow-[0_0_30px_hsl(258,90%,66%,0.15)]',
  } as const;
  const iconBg = {
    sky: 'bg-sky-500/15 text-sky-400 ring-sky-500/30',
    emerald: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
    violet: 'bg-violet-500/15 text-violet-400 ring-violet-500/30',
  } as const;

  return (
    <Link
      href={href}
      className={`group relative flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-5 ring-1 ring-transparent transition-all hover:-translate-y-0.5 ${ring[accent]}`}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 transition-transform group-hover:scale-105 ${iconBg[accent]}`}
      >
        <span className="h-5 w-5">{icon}</span>
      </span>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="mt-auto flex items-center gap-1.5 text-xs font-medium text-primary">
        Ir agora
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
    </Link>
  );
}
