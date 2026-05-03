import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Shared shell for the /login, /register, and /verificar-email pages.
 *
 * Design mirrors the Developer Console auth gate: full-screen dark canvas
 * (`bg-ink`) with a subtle background grid + dual glow, centred content
 * with a whisper-thin card border. Copper accent throughout.
 */
export interface AuthLayoutProps {
  title: string;
  description?: string;
  /** Content rendered below the card (links, legal copy, etc.) */
  footer?: ReactNode;
  children: ReactNode;
}

export function AuthLayout({
  title,
  description,
  footer,
  children,
}: AuthLayoutProps): JSX.Element {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-16 sm:py-20 bg-ink">

      {/* ── Background layers ───────────────────────────────────────── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        {/* Faint terminal grid */}
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'linear-gradient(to right, hsl(28 72% 58% / 0.06) 1px, transparent 1px), ' +
              'linear-gradient(to bottom, hsl(28 72% 58% / 0.06) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
            maskImage:
              'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 80%)',
          }}
        />
        {/* Copper glow — bottom */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 55% 45% at 50% 70%, hsl(28 72% 58% / 0.07) 0%, transparent 70%)',
          }}
        />
        {/* Copper glow — top-right accent */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 35% 25% at 65% 15%, hsl(28 72% 58% / 0.05) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="animate-fade-up w-full max-w-md">

        {/* Brand mark */}
        <Link
          href="/"
          className="mx-auto mb-8 flex w-fit items-center gap-2.5 group"
          aria-label="SZDevs — voltar à página inicial"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-copper/30 bg-copper/8 transition-colors group-hover:border-copper/60">
            {/* </> glyph */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4 text-copper"
              aria-hidden="true"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <span className="font-display text-base font-semibold tracking-tight text-foreground">
            SZDevs
          </span>
        </Link>

        {/* Heading */}
        <div className="mb-6 text-center">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-copper">
            {'// acesso à plataforma'}
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 font-body text-sm leading-relaxed text-ash">
              {description}
            </p>
          ) : null}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8">
          {children}
        </div>

        {/* Footer */}
        {footer ? (
          <p className="mt-6 text-center font-body text-sm text-ash">
            {footer}
          </p>
        ) : null}

        {/* Security note */}
        <p className="mt-8 text-center font-mono text-[10px] text-ash/30">
          Conexão segura · SZDevs Platform
        </p>
      </div>
    </main>
  );
}
