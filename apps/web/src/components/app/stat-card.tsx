import { cn } from '@devtechs/ui';

/**
 * StatCard — metric tile used on dashboards. Three slots:
 *
 *   - label:  a short lowercase caption ("TICKETS ABERTOS")
 *   - value:  the headline number (big, bold, gradient-ish)
 *   - delta:  optional trend chip ("+12% vs mês anterior")
 *
 * Visual: left-to-right gradient accent bar, subtle inner glow
 * on the accent color, background sits on the app's card token
 * so dark/light themes just work.
 */
export interface StatCardProps {
  label: string;
  value: string | number;
  delta?: { value: string; positive?: boolean };
  hint?: string;
  icon?: JSX.Element;
  accent?: 'sky' | 'emerald' | 'amber' | 'rose' | 'violet';
}

const ACCENTS = {
  sky:     'from-sky-500/80 to-indigo-500/80 shadow-[0_0_40px_hsl(217,91%,60%,0.12)]',
  emerald: 'from-emerald-500/80 to-teal-500/80 shadow-[0_0_40px_hsl(160,84%,39%,0.12)]',
  amber:   'from-amber-500/80 to-orange-500/80 shadow-[0_0_40px_hsl(38,92%,50%,0.12)]',
  rose:    'from-rose-500/80 to-pink-500/80 shadow-[0_0_40px_hsl(346,77%,50%,0.12)]',
  violet:  'from-violet-500/80 to-fuchsia-500/80 shadow-[0_0_40px_hsl(258,90%,66%,0.12)]',
} as const;

const ICON_BG = {
  sky:     'bg-sky-500/15 text-sky-400 ring-sky-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
  amber:   'bg-amber-500/15 text-amber-400 ring-amber-500/30',
  rose:    'bg-rose-500/15 text-rose-400 ring-rose-500/30',
  violet:  'bg-violet-500/15 text-violet-400 ring-violet-500/30',
} as const;

export function StatCard({
  label,
  value,
  delta,
  hint,
  icon,
  accent = 'sky',
}: StatCardProps): JSX.Element {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-border',
      )}
    >
      {/* Gradient accent bar */}
      <div
        className={cn(
          'absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r',
          ACCENTS[accent],
        )}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums text-foreground">
            {value}
          </div>
          {hint ? (
            <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
          ) : null}
        </div>
        {icon ? (
          <span
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg ring-1 transition-transform group-hover:scale-105',
              ICON_BG[accent],
            )}
          >
            <span className="h-5 w-5">{icon}</span>
          </span>
        ) : null}
      </div>

      {delta ? (
        <div className="mt-4 flex items-center gap-1.5 text-xs font-medium">
          <span
            className={cn(
              'flex items-center gap-0.5',
              delta.positive ? 'text-emerald-400' : 'text-rose-400',
            )}
          >
            <svg
              viewBox="0 0 12 12"
              fill="currentColor"
              className="h-3 w-3"
              aria-hidden="true"
            >
              {delta.positive ? (
                <path d="M6 2l4 5H2z" />
              ) : (
                <path d="M6 10L2 5h8z" />
              )}
            </svg>
            {delta.value}
          </span>
          <span className="text-muted-foreground">vs mês anterior</span>
        </div>
      ) : null}
    </div>
  );
}
