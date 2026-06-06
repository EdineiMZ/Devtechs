'use client';

import { Code2 } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col bg-ink text-foreground">
      {/* Copper radial glow — top right */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 55% 55% at 80% 10%, hsl(28 72% 58% / 0.09) 0%, transparent 70%)',
        }}
        aria-hidden
      />
      {/* Acid radial glow — bottom left */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 40% 40% at 10% 90%, hsl(160 100% 48% / 0.06) 0%, transparent 70%)',
        }}
        aria-hidden
      />

      {/* Top bar — mirrors the sidebar brand */}
      <header className="relative z-10 flex h-16 shrink-0 items-center gap-2.5 border-b border-white/5 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-acid/30 bg-acid/8">
          <Code2 className="h-4 w-4 text-acid" />
        </div>
        <div className="leading-tight">
          <div className="font-display text-sm font-semibold tracking-tight text-foreground">
            SZDevs
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-ash/60">
            Platform
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
        <div className="w-full max-w-lg">
          {/* Terminal label */}
          <div className="mb-6 inline-flex items-center gap-2 rounded border border-copper/25 bg-copper/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest text-copper animate-fade-in">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-copper opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-copper" />
            </span>
            {'// erro.404'}
          </div>

          {/* 404 number */}
          <div className="animate-fade-up mb-4 font-mono text-[clamp(5rem,16vw,9rem)] font-bold leading-none tracking-tighter text-copper">
            404
          </div>

          {/* Divider */}
          <div className="animate-fade-up-delay-1 mb-6 h-px w-full bg-gradient-to-r from-copper/40 via-copper/10 to-transparent" />

          {/* Card */}
          <div className="animate-fade-up-delay-1 relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] p-8">
            {/* Top accent */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-copper/35 to-transparent" />

            <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-foreground">
              Página não encontrada
            </h1>
            <p className="mt-3 font-body text-sm text-ash/70">
              O endereço que você tentou acessar não existe, foi removido ou você
              não tem permissão para visualizá-lo.
            </p>

            {/* Actions */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-copper/15 px-4 font-body text-sm font-medium text-copper ring-1 ring-copper/25 transition-all hover:bg-copper/25 hover:shadow-[0_0_16px_hsl(28,72%,58%,0.20)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Ir para o início
              </Link>

              <button
                type="button"
                onClick={() => window.history.back()}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-4 font-body text-sm font-medium text-ash/80 transition-all hover:border-white/15 hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Voltar
              </button>
            </div>
          </div>

          {/* Footer hint */}
          <p className="animate-fade-up-delay-2 mt-6 font-mono text-[10px] uppercase tracking-widest text-ash/30">
            SZDevs Platform · v0.1.0
          </p>
        </div>
      </main>
    </div>
  );
}
