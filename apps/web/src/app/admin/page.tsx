import { redirect } from 'next/navigation';

import { Badge } from '@devtechs/ui';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { Icon } from '@/components/app/icons';
import { ModuleCard } from '@/components/app/module-card';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { StatCard } from '@/components/app/stat-card';

/**
 * Admin dashboard — the main landing for users holding the
 * `admin` role. Server component: the session is read once and
 * threaded into the shell so the sidebar already knows which
 * items the current user has access to before any JS loads.
 */
export const dynamic = 'force-dynamic';

export default async function AdminPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin');
  const user = session.user;
  if (!user.roles.includes('admin')) redirect('/perfil');

  // In a real deployment these numbers come from a fan-out to
  // each module service. For now we stub them with zeros so the
  // layout renders in full — the `hint` field carries the
  // "aguardando dados" message.
  const STATS = [
    {
      label: 'Tickets abertos',
      value: 0,
      delta: { value: '—', positive: true },
      accent: 'sky' as const,
      icon: Icon.ticket,
      hint: 'aguardando support-service',
    },
    {
      label: 'Projetos ativos',
      value: 1,
      delta: { value: '+1', positive: true },
      accent: 'violet' as const,
      icon: Icon.briefcase,
      hint: 'projetos em andamento',
    },
    {
      label: 'Receita mensal',
      value: 'R$ 0',
      delta: { value: '—', positive: true },
      accent: 'emerald' as const,
      icon: Icon.dollar,
      hint: 'mês corrente',
    },
    {
      label: 'Pipelines hoje',
      value: 1,
      delta: { value: '+1', positive: true },
      accent: 'amber' as const,
      icon: Icon.zap,
      hint: 'últimas 24h',
    },
  ];

  const MODULES = [
    {
      title: 'Recursos Humanos',
      description:
        'Funcionários, férias, folha de ponto, avaliações e documentos.',
      href: '/admin/rh',
      permission: 'rh:employees:view',
      accent: 'emerald' as const,
      icon: Icon.users,
      stats: [
        { label: 'Ativos', value: '—' },
        { label: 'Férias', value: '—' },
      ],
    },
    {
      title: 'Financeiro',
      description:
        'Lançamentos, fluxo de caixa, notas fiscais e DRE simplificado.',
      href: '/admin/financeiro',
      permission: 'finance:reports:view',
      accent: 'sky' as const,
      icon: Icon.dollar,
      stats: [
        { label: 'Receita', value: '—' },
        { label: 'Despesas', value: '—' },
      ],
    },
    {
      title: 'Projetos',
      description:
        'Kanban, sprints, tracking de tempo, burndown e boards.',
      href: '/admin/projetos',
      permission: 'projects:reports:view',
      accent: 'violet' as const,
      icon: Icon.briefcase,
      stats: [
        { label: 'Ativos', value: '1' },
        { label: 'Sprints', value: '0' },
      ],
    },
    {
      title: 'Suporte',
      description:
        'Tickets, SLA, CSAT, chat em tempo real e base de conhecimento.',
      href: '/admin/suporte',
      permission: 'support:tickets:view',
      accent: 'rose' as const,
      icon: Icon.ticket,
      stats: [
        { label: 'Abertos', value: '0' },
        { label: 'SLA', value: '100%' },
      ],
    },
    {
      title: 'DevOps',
      description:
        'Pipelines, deploys, rollback, environments e GitHub webhooks.',
      href: '/admin/devops',
      permission: 'devops:pipelines:view',
      accent: 'amber' as const,
      icon: Icon.zap,
      stats: [
        { label: 'Pipelines', value: '1' },
        { label: 'Ambientes', value: '0' },
      ],
    },
    {
      title: 'Developer',
      description:
        'Logs, configurações, saúde dos serviços e diagnóstico.',
      href: '/admin/developer',
      permission: 'dev:logs:view',
      accent: 'cyan' as const,
      icon: Icon.code,
      stats: [
        { label: 'Serviços', value: '10' },
        { label: 'Incidentes', value: '0' },
      ],
    },
  ];

  return (
    <AppShell
      pathname="/admin"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[{ label: 'Admin' }, { label: 'Visão geral' }]}
    >
      {/* Hero */}
      <section className="relative mb-8 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] p-8">
        {/* Copper glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 70% at 80% 20%, hsl(28 72% 58% / 0.10) 0%, transparent 70%)' }} />
        {/* Acid glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 40% 50% at 10% 80%, hsl(160 100% 48% / 0.06) 0%, transparent 70%)' }} />
        {/* Top border accent */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-copper/40 to-transparent" />

        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded border border-acid/25 bg-acid/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest text-acid">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-acid opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-acid" />
              </span>
              // console administrativo
            </div>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-foreground">
              Bem-vindo,{' '}
              <span className="text-copper">
                {user.name?.split(' ')[0] ?? 'administrador'}
              </span>
            </h1>
            <p className="mt-3 max-w-2xl font-body text-sm text-ash">
              Painel unificado de todos os módulos da plataforma DevsTech. Você
              tem {user.permissions.length} permissões ativas e acesso completo
              aos microserviços NestJS.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {user.emailVerified ? (
              <Badge variant="success">Email verificado</Badge>
            ) : (
              <Badge variant="warning">Email não verificado</Badge>
            )}
            <Badge variant="default">{user.mainRole}</Badge>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="mb-10">
        <h2 className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-widest text-ash/60">
          // indicadores
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      </section>

      {/* Modules */}
      <section className="mb-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ash/60">
              // módulos da plataforma
            </h2>
            <p className="mt-1 font-body text-sm text-ash/60">
              Cada módulo é servido por um microserviço NestJS dedicado, com
              permissões isoladas e seu próprio banco de eventos.
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((mod) => (
            <ModuleCard
              key={mod.href}
              title={mod.title}
              description={mod.description}
              href={mod.href}
              accent={mod.accent}
              granted={user.permissions.includes(mod.permission)}
              icon={mod.icon}
              stats={mod.stats}
            />
          ))}
        </div>
      </section>

      {/* Session */}
      <section className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ash/60">
            // sessão atual
          </h2>
          <span className="font-mono text-[10px] text-ash/40">
            resolvida pelo auth-service
          </span>
        </div>
        <dl className="grid gap-4 sm:grid-cols-4">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-ash/50">Usuário</dt>
            <dd className="mt-1 font-body text-sm font-medium text-foreground">{user.name ?? user.email}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-ash/50">Email</dt>
            <dd className="mt-1 font-body text-sm font-medium text-foreground">{user.email}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-ash/50">Role principal</dt>
            <dd className="mt-1 font-body text-sm font-medium text-copper">{user.mainRole ?? '—'}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-ash/50">Permissões ativas</dt>
            <dd className="mt-1 font-display text-sm font-semibold tabular-nums text-acid">{user.permissions.length}</dd>
          </div>
        </dl>
      </section>
    </AppShell>
  );
}
