import Link from 'next/link';

import { Badge } from '@devtechs/ui';

/**
 * Friendly placeholder for module pages whose UI hasn't shipped yet.
 * The corresponding NestJS service is already running — only the
 * Next.js surface is missing.
 */
export interface ModuleStubHeroProps {
  title: string;
  subtitle: string;
  /** Permission that gates this module. When the user is missing
   *  it, render a "Sem acesso" notice instead of the regular hero. */
  permission?: string;
  userPermissions: string[];
  accent: 'emerald' | 'sky' | 'violet' | 'amber';
  comingSoonItems: string[];
}

export function ModuleStubHero({
  title,
  subtitle,
  permission,
  userPermissions,
  accent,
  comingSoonItems,
}: ModuleStubHeroProps): JSX.Element {
  const hasAccess = !permission || userPermissions.includes(permission);

  const accentClasses = {
    emerald: {
      glow: 'from-emerald-500/15 via-transparent',
      border: 'border-emerald-500/30',
      pill: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
      text: 'from-emerald-300 to-sky-300',
    },
    sky: {
      glow: 'from-sky-500/15 via-transparent',
      border: 'border-sky-500/30',
      pill: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
      text: 'from-sky-300 to-violet-300',
    },
    violet: {
      glow: 'from-violet-500/15 via-transparent',
      border: 'border-violet-500/30',
      pill: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
      text: 'from-violet-300 to-fuchsia-300',
    },
    amber: {
      glow: 'from-amber-500/15 via-transparent',
      border: 'border-amber-500/30',
      pill: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
      text: 'from-amber-300 to-orange-300',
    },
  }[accent];

  if (!hasAccess) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-ash">
          Sua conta não tem permissão para acessar este módulo. Solicite ao
          administrador o acesso{' '}
          <code className="rounded bg-secondary px-1 py-0.5 text-xs">
            {permission}
          </code>
          .
        </p>
        <Link
          href="/admin"
          className="mt-4 inline-flex text-sm text-copper underline-offset-4 hover:underline"
        >
          Voltar à visão geral
        </Link>
      </div>
    );
  }

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-8 ${accentClasses.border} ${accentClasses.glow} from-card via-card to-card`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(217,91%,60%,0.08),transparent_60%)]" />
      <div className="relative">
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${accentClasses.pill}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Em construção
        </div>
        <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-foreground">
          <span
            className={`bg-gradient-to-r bg-clip-text text-transparent ${accentClasses.text}`}
          >
            {title}
          </span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-ash">
          {subtitle}
        </p>

        <div className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ash">
            Em breve neste painel
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {comingSoonItems.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 rounded-md border border-white/8 bg-background/40 px-3 py-2 text-sm"
              >
                <Badge variant="default" className="px-1.5">
                  •
                </Badge>
                <span className="text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-xs text-ash">
          A API REST do módulo já está disponível —{' '}
          <code className="rounded bg-secondary px-1 py-0.5 text-[11px]">
            services/{title.toLowerCase()}-service
          </code>
          . As telas do painel chegam nos próximos sprints.
        </p>
      </div>
    </section>
  );
}
