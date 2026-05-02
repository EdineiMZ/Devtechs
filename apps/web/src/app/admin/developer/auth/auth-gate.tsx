'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { confirmDeveloperAccess } from './actions';

/**
 * Full-page lock screen rendered by the developer layout when the
 * dev_access cookie is missing or expired. Replaces the page content
 * so there are no redirect loops between the layout and a sub-route.
 */
export function DeveloperAuthGate(): JSX.Element {
  const router                     = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword]    = useState('');
  const [error, setError]          = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await confirmDeveloperAccess(password);
      if (result.ok) {
        // Hard-refresh so the layout re-runs and picks up the new cookie
        router.refresh();
      } else {
        setError(result.error ?? 'Acesso negado');
        setPassword('');
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink">
      <div className="w-full max-w-sm px-4">
        {/* Lock icon + header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-copper/30 bg-copper/8">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-8 w-8 text-copper"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-copper">
            // acesso restrito
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
            Developer Console
          </h1>
          <p className="mt-1 font-body text-sm text-ash">
            Confirme sua senha para acessar. A sessão expira em 30 minutos.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label
              htmlFor="dev-password"
              className="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-wider text-ash/70"
            >
              Senha da conta
            </label>
            <input
              id="dev-password"
              type="password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={pending}
              className="w-full rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3 font-body text-sm text-foreground placeholder-ash/30 transition-colors focus:border-copper/40 focus:outline-none focus:ring-1 focus:ring-copper/20 disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4 shrink-0 text-red-400"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="font-body text-sm text-red-400">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={pending || !password}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-copper px-4 py-3 font-body text-sm font-semibold text-ink transition-all hover:bg-copper/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
                Verificando…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Confirmar acesso
              </>
            )}
          </button>

          <div className="pt-2 text-center">
            <a
              href="/admin"
              className="font-body text-xs text-ash/50 transition-colors hover:text-ash"
            >
              ← Voltar ao painel
            </a>
          </div>
        </form>

        {/* Security note */}
        <p className="mt-8 text-center font-mono text-[10px] text-ash/30">
          Sessão protegida · HMAC-SHA256 · TTL 30 min
        </p>
      </div>
    </div>
  );
}
