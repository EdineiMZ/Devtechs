import Link from 'next/link';

import { Badge, cn } from '@devtechs/ui';

/**
 * ModuleCard — a hoverable tile used on the admin dashboard to
 * advertise the platform's modules. Supports a disabled state
 * for permissions the caller doesn't hold.
 */
export interface ModuleCardProps {
  title: string;
  description: string;
  href: string;
  accent: 'sky' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan';
  granted: boolean;
  icon: JSX.Element;
  stats?: Array<{ label: string; value: string | number }>;
}

const ACCENT_RING = {
  sky: 'hover:ring-sky-500/40 hover:shadow-[0_0_30px_hsl(217,91%,60%,0.15)]',
  emerald: 'hover:ring-emerald-500/40 hover:shadow-[0_0_30px_hsl(160,84%,39%,0.15)]',
  amber: 'hover:ring-amber-500/40 hover:shadow-[0_0_30px_hsl(38,92%,50%,0.15)]',
  rose: 'hover:ring-rose-500/40 hover:shadow-[0_0_30px_hsl(346,77%,50%,0.15)]',
  violet: 'hover:ring-violet-500/40 hover:shadow-[0_0_30px_hsl(258,90%,66%,0.15)]',
  cyan: 'hover:ring-cyan-500/40 hover:shadow-[0_0_30px_hsl(189,94%,43%,0.15)]',
} as const;

const ACCENT_ICON = {
  sky: 'bg-sky-500/15 text-sky-400 ring-sky-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-400 ring-amber-500/30',
  rose: 'bg-rose-500/15 text-rose-400 ring-rose-500/30',
  violet: 'bg-violet-500/15 text-violet-400 ring-violet-500/30',
  cyan: 'bg-cyan-500/15 text-cyan-400 ring-cyan-500/30',
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
        'group relative flex h-full flex-col gap-4 overflow-hidden rounded-xl border border-border/60 bg-card p-5 ring-1 ring-transparent transition-all',
        granted
          ? cn('hover:-translate-y-0.5', ACCENT_RING[accent])
          : 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl ring-1 transition-transform group-hover:scale-105',
            ACCENT_ICON[accent],
          )}
        >
          <span className="h-5 w-5">{icon}</span>
        </span>
        {granted ? (
          <Badge variant="success">disponível</Badge>
        ) : (
          <Badge variant="outline">sem acesso</Badge>
        )}
      </div>

      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      {stats ? (
        <div className="mt-auto grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                {s.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
        {granted ? (
          <>
            Abrir módulo
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
          </>
        ) : (
          <span className="text-muted-foreground">
            Solicite acesso ao administrador
          </span>
        )}
      </div>
    </div>
  );

  if (!granted) return body;
  return (
    <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl">
      {body}
    </Link>
  );
}
