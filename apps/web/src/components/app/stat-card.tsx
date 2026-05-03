import { cn } from '@szdevs/ui';

/**
 * StatCard — metric tile used on dashboards.
 * Copper/acid terminal aesthetic with colored accent bars.
 */
export interface StatCardProps {
  label: string;
  value: string | number;
  delta?: { value: string; positive?: boolean };
  hint?: string;
  icon?: JSX.Element;
  accent?: 'sky' | 'emerald' | 'amber' | 'rose' | 'violet' | 'copper' | 'acid';
}

const ACCENT_BAR = {
  sky:     'from-sky-500/70 to-indigo-500/70',
  emerald: 'from-emerald-500/70 to-teal-500/70',
  amber:   'from-amber-500/70 to-orange-500/70',
  rose:    'from-rose-500/70 to-pink-500/70',
  violet:  'from-violet-500/70 to-fuchsia-500/70',
  copper:  'from-copper/70 to-ember/70',
  acid:    'from-acid/70 to-teal-400/70',
} as const;

const ICON_BG = {
  sky:     'bg-sky-500/10 text-sky-400 ring-sky-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  amber:   'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  rose:    'bg-rose-500/10 text-rose-400 ring-rose-500/20',
  violet:  'bg-violet-500/10 text-violet-400 ring-violet-500/20',
  copper:  'bg-copper/10 text-copper ring-copper/20',
  acid:    'bg-acid/10 text-acid ring-acid/20',
} as const;

export function StatCard({
  label,
  value,
  delta,
  hint,
  icon,
  accent = 'copper',
}: StatCardProps): JSX.Element {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] p-5 transition-all hover:-translate-y-0.5 hover:border-white/12 hover:bg-white/[0.04]">
      {/* Accent bar */}
      <div className={cn('absolute left-0 right-0 top-0 h-px bg-gradient-to-r', ACCENT_BAR[accent])} />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ash/70">
            {label}
          </div>
          <div className="mt-2 font-display text-3xl font-bold tabular-nums text-foreground">
            {value}
          </div>
          {hint ? (
            <div className="mt-1 font-body text-xs text-ash/60">{hint}</div>
          ) : null}
        </div>
        {icon ? (
          <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg ring-1 transition-transform group-hover:scale-105', ICON_BG[accent])}>
            <span className="h-5 w-5">{icon}</span>
          </span>
        ) : null}
      </div>

      {delta ? (
        <div className="mt-4 flex items-center gap-1.5 font-mono text-xs font-medium">
          <span className={cn('flex items-center gap-0.5', delta.positive ? 'text-acid' : 'text-rose-400')}>
            <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3" aria-hidden="true">
              {delta.positive ? <path d="M6 2l4 5H2z" /> : <path d="M6 10L2 5h8z" />}
            </svg>
            {delta.value}
          </span>
          <span className="text-ash/50">vs mês anterior</span>
        </div>
      ) : null}
    </div>
  );
}
