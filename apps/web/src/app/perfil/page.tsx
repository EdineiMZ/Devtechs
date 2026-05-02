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
      <section className="relative mb-8 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] p-8">
        {/* Copper glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 55% 65% at 85% 15%, hsl(28 72% 58% / 0.09) 0%, transparent 70%)' }} />
        {/* Acid glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 40% 45% at 5% 85%, hsl(160 100% 48% / 0.05) 0%, transparent 70%)' }} />
        {/* Top border accent */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-copper/35 to-transparent" />

        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded border border-copper/25 bg-copper/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest text-copper">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-copper opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-copper" />
              </span>
              {'// portal do cliente'}
            </div>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-foreground">
              Olá,{' '}
              <span className="text-copper">
                {user.name?.split(' ')[0] ?? user.email}
              </span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-ash">
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
        <h2 className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-widest text-ash/60">
          {'// indicadores'}
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
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-copper/10 text-copper ring-1 ring-copper/20">
              <span className="h-5 w-5">{Icon.shield}</span>
            </span>
            <div>
              <h2 className="font-display text-sm font-semibold text-foreground">Dados da conta</h2>
              <p className="font-body text-xs text-ash/60">Mantenha seu cadastro atualizado</p>
            </div>
          </div>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="font-mono text-xs text-ash/50">Nome</dt>
              <dd className="font-body text-sm font-medium text-foreground">{user.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-mono text-xs text-ash/50">Email</dt>
              <dd className="font-body text-sm font-medium text-foreground">{user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-mono text-xs text-ash/50">Role</dt>
              <dd className="font-body text-sm font-medium text-copper">{user.mainRole ?? 'member'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-acid/10 text-acid ring-1 ring-acid/20">
              <span className="h-5 w-5">{Icon.check}</span>
            </span>
            <div>
              <h2 className="font-display text-sm font-semibold text-foreground">Acessos ativos</h2>
              <p className="font-body text-xs text-ash/60">{user.permissions.length} permissões concedidas</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {user.permissions.length === 0 ? (
              <span className="font-body text-xs text-ash/50">
                Sem permissões extras. Usando o conjunto padrão do seu role.
              </span>
            ) : (
              user.permissions.slice(0, 24).map((perm) => (
                <code key={perm} className="code-pill">{perm}</code>
              ))
            )}
            {user.permissions.length > 24 ? (
              <span className="font-mono text-[10px] text-ash/40">
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
  icon,
}: QuickActionProps): JSX.Element {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-5 transition-all hover:-translate-y-0.5 hover:border-copper/25 hover:shadow-[0_0_24px_hsl(28,72%,58%,0.10)]"
    >
      {/* Top accent on hover */}
      <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-copper/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-copper/10 text-copper ring-1 ring-copper/20 transition-transform group-hover:scale-105">
        <span className="h-5 w-5">{icon}</span>
      </span>
      <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
      <p className="font-body text-sm text-ash/70">{description}</p>
      <div className="mt-auto flex items-center gap-1.5 font-body text-xs font-medium text-copper">
        Ir agora
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
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
