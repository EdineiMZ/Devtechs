import Link from 'next/link';

import { Badge, cn } from '@szdevs/ui';

/**
 * ModuleCard — hoverable platform module tile for the admin dashboard.
 * Copper/acid terminal aesthetic with colored icon accents.
 */
export interface ModuleCardProps {
  title: string;
  description: string;
  href: string;
  accent: 'sky' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan' | 'copper' | 'acid';
  granted: boolean;
  icon: JSX.Element;
  stats?: Array<{ label: string; value: string | number }>;
}

const ACCENT_HOVER = {
  sky:     'hover:border-sky-500/30 hover:shadow-[0_0_24px_hsl(217,91%,60%,0.12)]',
  emerald: 'hover:border-emerald-500/30 hover:shadow-[0_0_24px_hsl(160,84%,39%,0.12)]',
  amber:   'hover:border-amber-500/30 hover:shadow-[0_0_24px_hsl(38,92%,50%,0.12)]',
  rose:    'hover:border-rose-500/30 hover:shadow-[0_0_24px_hsl(346,77%,50%,0.12)]',
  violet:  'hover:border-violet-500/30 hover:shadow-[0_0_24px_hsl(258,90%,66%,0.12)]',
  cyan:    'hover:border-cyan-500/30 hover:shadow-[0_0_24px_hsl(189,94%,43%,0.12)]',
  copper:  'hover:border-copper/30 hover:shadow-[0_0_24px_hsl(28,72%,58%,0.12)]',
  acid:    'hover:border-acid/30 hover:shadow-[0_0_24px_hsl(160,100%,48%,0.12)]',
} as const;

const ACCENT_ICON = {
  sky:     'bg-sky-500/10 text-sky-400 ring-sky-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  amber:   'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  rose:    'bg-rose-500/10 text-rose-400 ring-rose-500/20',
  violet:  'bg-violet-500/10 text-violet-400 ring-violet-500/20',
  cyan:    'bg-cyan-500/10 text-cyan-400 ring-cyan-500/20',
  copper:  'bg-copper/10 text-copper ring-copper/20',
  acid:    'bg-acid/10 text-acid ring-acid/20',
} as const;

export function ModuleCard({
  title,
  description,
  href,
  accent,
  granted,
  icon,
  stats,
}: ModuleCardProps): JSX.Element {
  const body = (
    <div
      className={cn(
        'group relative flex h-full flex-col gap-4 overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] p-5 transition-all',
        granted
          ? cn('hover:-translate-y-0.5', ACCENT_HOVER[accent])
          : 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl ring-1 transition-transform group-hover:scale-105', ACCENT_ICON[accent])}>
          <span className="h-5 w-5">{icon}</span>
        </span>
        {granted ? (
          <Badge variant="success">disponível</Badge>
        ) : (
          <Badge variant="outline">sem acesso</Badge>
        )}
      </div>

      <div>
        <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 font-body text-sm text-ash/70">{description}</p>
      </div>

      {stats ? (
        <div className="mt-auto grid grid-cols-2 gap-3 border-t border-white/8 pt-3">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="font-mono text-[10px] uppercase tracking-widest text-ash/50">
                {s.label}
              </div>
              <div className="mt-0.5 font-display text-sm font-semibold tabular-nums text-foreground">
                {s.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-1.5 font-body text-xs font-medium">
        {granted ? (
          <>
            <span className="text-copper">Abrir módulo</span>
            <svg
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="h-3.5 w-3.5 text-copper transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </>
        ) : (
          <span className="text-ash/50">Solicite acesso ao administrador</span>
        )}
      </div>
    </div>
  );

  if (!granted) return body;
  return (
    <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-copper/50 focus-visible:ring-offset-2 rounded-xl">
      {body}
    </Link>
  );
}
