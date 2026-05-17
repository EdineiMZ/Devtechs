'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import { confirmDeveloperAccess, confirmDeveloperTOTP } from './actions';

type Step = 'password' | 'totp';

/**
 * Full-page lock screen rendered by the developer layout when the
 * dev_access cookie is missing or expired. Replaces the page content
 * so there are no redirect loops between the layout and a sub-route.
 *
 * Flow:
 *  1. User enters account password.
 *     - No 2FA on account → cookie set → router.refresh()
 *     - 2FA enabled       → show TOTP step
 *  2. User enters 6-digit authenticator code.
 *     - Valid → cookie set → router.refresh()
 */
export function DeveloperAuthGate(): JSX.Element {
  const router                      = useRouter();
  const [pending, startTransition]  = useTransition();

  const [step, setStep]             = useState<Step>('password');
  const [password, setPassword]     = useState('');
  const [totp, setTotp]             = useState('');
  const [tempToken, setTempToken]   = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  const totpInputRef = useRef<HTMLInputElement>(null);

  // ── Step 1: password ─────────────────────────────────────────────────

  function handlePasswordSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await confirmDeveloperAccess(password);

      if (result.ok) {
        router.refresh();
        return;
      }

      if (result.requires2FA && result.tempToken) {
        setTempToken(result.tempToken);
        setStep('totp');
        setPassword('');
        // Focus the TOTP input on next tick
        setTimeout(() => totpInputRef.current?.focus(), 50);
        return;
      }

      setError(result.error ?? 'Acesso negado');
      setPassword('');
    });
  }

  // ── Step 2: TOTP ──────────────────────────────────────────────────────

  /**
   * Always receives the fresh `code` as a parameter so we never rely on
   * the `totp` state value, which may still be stale when called from
   * handleTotpChange (React state updates are async — the auto-submit fires
   * before the new value is committed to state).
   */
  function submitTotp(code: string): void {
    if (!tempToken) return;
    setError(null);
    startTransition(async () => {
      const result = await confirmDeveloperTOTP(tempToken, code);
      if (result.ok) {
        router.refresh();
        return;
      }
      setError(result.error ?? 'Código inválido');
      setTotp('');
    });
  }

  function handleTotpSubmit(e: React.FormEvent): void {
    e.preventDefault();
    submitTotp(totp);
  }

  function handleTotpChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setTotp(val);
    // Auto-submit when 6 digits are entered — pass `val` directly so we
    // never read the stale `totp` state inside the submit handler.
    if (val.length === 6 && !pending) {
      submitTotp(val);
    }
  }

  // ── Shared error block ────────────────────────────────────────────────

  const errorBlock = error ? (
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
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink">
      <div className="w-full max-w-sm px-4">

        {/* Lock icon + header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-copper/30 bg-copper/8">
            {step === 'password' ? (
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
            ) : (
              /* Shield icon for TOTP step */
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-8 w-8 text-copper"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            )}
          </div>

          <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-copper">
            {step === 'password' ? '// acesso restrito' : '// autenticação em dois fatores'}
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
            Developer Console
          </h1>
          <p className="mt-1 font-body text-sm text-ash">
            {step === 'password'
              ? 'Confirme sua senha para acessar. A sessão expira em 30 minutos.'
              : 'Abra o app autenticador e insira o código de 6 dígitos.'}
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <div
            className={`h-1.5 w-8 rounded-full transition-colors ${
              step === 'password' ? 'bg-copper' : 'bg-copper/30'
            }`}
          />
          <div
            className={`h-1.5 w-8 rounded-full transition-colors ${
              step === 'totp' ? 'bg-copper' : 'bg-copper/30'
            }`}
          />
        </div>

        {/* ── Password form ── */}
        {step === 'password' && (
          <form
            onSubmit={(e) => handlePasswordSubmit(e)}
            className="space-y-4"
          >
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
                autoComplete="new-password"
                autoFocus
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={pending}
                className="w-full rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3 font-body text-sm text-foreground placeholder-ash/30 transition-colors focus:border-copper/40 focus:outline-none focus:ring-1 focus:ring-copper/20 disabled:opacity-50"
              />
            </div>

            {errorBlock}

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
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4"
                  >
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
        )}

        {/* ── TOTP form ── */}
        {step === 'totp' && (
          <form
            onSubmit={(e) => handleTotpSubmit(e)}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="dev-totp"
                className="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-wider text-ash/70"
              >
                Código do autenticador
              </label>
              <input
                ref={totpInputRef}
                id="dev-totp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={totp}
                onChange={handleTotpChange}
                placeholder="000000"
                disabled={pending}
                className="w-full rounded-lg border border-white/8 bg-white/[0.03] px-4 py-4 text-center font-mono text-2xl tracking-[0.5em] text-foreground placeholder-ash/20 transition-colors focus:border-copper/40 focus:outline-none focus:ring-1 focus:ring-copper/20 disabled:opacity-50"
              />
              <p className="mt-1.5 text-center font-body text-[11px] text-ash/50">
                O código é gerado a cada 30 segundos
              </p>
            </div>

            {errorBlock}

            <button
              type="submit"
              disabled={pending || totp.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-copper px-4 py-3 font-body text-sm font-semibold text-ink transition-all hover:bg-copper/85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
                  Verificando…
                </>
              ) : (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Verificar código
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setStep('password');
                  setTempToken(null);
                  setTotp('');
                  setError(null);
                }}
                className="font-body text-xs text-ash/50 transition-colors hover:text-ash"
              >
                ← Usar outra senha
              </button>
            </div>
          </form>
        )}

        {/* Security note */}
        <p className="mt-8 text-center font-mono text-[10px] text-ash/30">
          Sessão protegida · HMAC-SHA256 · TTL 30 min
        </p>
      </div>
    </div>
  );
}
