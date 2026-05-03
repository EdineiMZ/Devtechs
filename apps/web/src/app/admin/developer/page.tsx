import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { devFetch } from '@/lib/developer-api';

import { ServicesGrid, type ServiceSummary } from './services-grid';

export const dynamic = 'force-dynamic';

const QUICK_ACTIONS = [
  {
    href: '/admin/developer/config',
    label: 'Config. Plataforma',
    desc: 'APIs, email, flags, storage',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
    accent: 'border-copper/20 hover:border-copper/40 hover:bg-copper/5 group-hover:text-copper',
  },
  {
    href: '/admin/developer/logs',
    label: 'Logs ao vivo',
    desc: 'Stream de logs dos serviços',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
    accent: 'border-acid/20 hover:border-acid/40 hover:bg-acid/5 group-hover:text-acid',
  },
  {
    href: '/admin/developer/queues',
    label: 'Filas BullMQ',
    desc: 'Jobs ativos, falhos e métricas',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
    accent: 'border-white/10 hover:border-white/20 hover:bg-white/[0.03] group-hover:text-foreground',
  },
  {
    href: '/admin/developer/vps',
    label: 'VPS Hostinger',
    desc: 'Servidores por cliente',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="20" x2="16" y2="20" />
      </svg>
    ),
    accent: 'border-white/10 hover:border-white/20 hover:bg-white/[0.03] group-hover:text-foreground',
  },
  {
    href: '/admin/developer/servicos',
    label: 'Monitor de Serviços',
    desc: 'Status, controle e logs em tempo real',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    accent: 'border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/5 group-hover:text-emerald-400',
  },
] as const;

export default async function DeveloperServicesPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/developer');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/developer');
  if (!user.permissions.includes('dev:logs:view')) redirect('/perfil');

  const res = await devFetch<ServiceSummary[]>('/services', { accessToken: session.accessToken });
  const services = res.ok && Array.isArray(res.data) ? (res.data as ServiceSummary[]) : [];
  const error = !res.ok
    ? (res.data as { message?: string })?.message ?? 'Falha ao buscar servicos'
    : null;

  return (
    <AppShell
      pathname="/admin/developer"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Developer' },
      ]}
    >
      {/* Header */}
      <header className="mb-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-copper">
          {'// developer console'}
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">
          Developer
        </h1>
        <p className="mt-1 font-body text-sm text-ash">
          Serviços, logs, filas e configurações da plataforma
        </p>
      </header>

      {/* Quick-action cards */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_ACTIONS.map((a) => (
          <a
            key={a.href}
            href={a.href}
            className={`group flex items-start gap-3 rounded-xl border bg-white/[0.02] p-4 transition-all ${a.accent}`}
          >
            <div className="mt-0.5 shrink-0 text-ash transition-colors">
              {a.icon}
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-foreground">{a.label}</p>
              <p className="mt-0.5 font-body text-xs text-ash">{a.desc}</p>
            </div>
          </a>
        ))}
      </div>

      {/* Services grid */}
      <ServicesGrid initial={services} error={error} />
    </AppShell>
  );
}
