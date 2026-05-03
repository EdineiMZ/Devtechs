'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Cookie Consent Banner — LGPD art. 7º, I + art. 8º
 *
 * Exibe na primeira visita e armazena a preferência em localStorage.
 * Cookies estritamente necessários (sessão, CSRF) nunca exigem opt-in.
 * Analytics e marketing só são "ativados" após aceite explícito.
 *
 * Chave de storage: "szdevs_cookie_consent"
 * Valores: undefined (não decidido) | "all" | "necessary"
 */

const STORAGE_KEY = 'szdevs_cookie_consent';

type Consent = 'all' | 'necessary';

/** Expõe a preferência atual para outros módulos da aplicação. */
export function getCookieConsent(): Consent | null {
  if (typeof window === 'undefined') return null;
  return (localStorage.getItem(STORAGE_KEY) as Consent) ?? null;
}

export function CookieBanner(): JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) setVisible(true);
  }, []);

  function save(choice: Consent): void {
    localStorage.setItem(STORAGE_KEY, choice);
    setVisible(false);

    // Dispara evento para que módulos de analytics possam reagir
    window.dispatchEvent(
      new CustomEvent('szdevs:cookie-consent', { detail: { consent: choice } }),
    );
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Preferências de cookies"
      className={[
        'fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl',
        'rounded-2xl border border-white/10 bg-carbon/95 backdrop-blur-md',
        'p-5 shadow-2xl',
        'animate-fade-up',
      ].join(' ')}
    >
      {/* ── Cabeçalho ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Cookie icon */}
          <span className="text-copper text-lg" aria-hidden="true">🍪</span>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-copper">
            {'// preferências de cookies'}
          </p>
        </div>
        <button
          onClick={() => save('necessary')}
          aria-label="Fechar e aceitar apenas necessários"
          className="text-ash/60 hover:text-ash transition-colors p-1 -mt-1 -mr-1"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Texto ──────────────────────────────────────────────────── */}
      <p className="mt-3 text-sm text-ash leading-relaxed">
        Usamos cookies estritamente necessários para o funcionamento da plataforma (sessão, segurança).
        Com sua autorização, também utilizamos cookies de{' '}
        <strong className="text-foreground">analytics</strong> para melhorar a experiência.{' '}
        <Link
          href="/privacidade#cookies"
          className="text-copper/80 hover:text-copper underline-offset-4 hover:underline"
        >
          Saiba mais na Política de Privacidade
        </Link>
        .
      </p>

      {/* ── Detalhes expansíveis ───────────────────────────────────── */}
      {showDetails ? (
        <div className="mt-4 space-y-3 rounded-lg border border-white/8 bg-white/[0.02] p-4 text-xs text-ash">
          <div>
            <p className="font-semibold text-foreground">Estritamente necessários</p>
            <p className="mt-0.5 opacity-75">Sessão de autenticação, token CSRF, preferências de idioma. Sem estes a plataforma não funciona. Não requerem consentimento (art. 7º, V LGPD — legítimo interesse).</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Analytics (opt-in)</p>
            <p className="mt-0.5 opacity-75">Dados agregados de uso para melhorar a plataforma. Nenhum dado é vendido ou compartilhado com terceiros para fins publicitários.</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Marketing (opt-in)</p>
            <p className="mt-0.5 opacity-75">Campanhas próprias da SZDevs. Atualmente desativado — nenhum cookie de marketing é definido.</p>
          </div>
        </div>
      ) : null}

      <button
        onClick={() => setShowDetails((v) => !v)}
        className="mt-2 text-xs text-ash/60 hover:text-ash underline-offset-4 hover:underline transition-colors"
      >
        {showDetails ? 'Ocultar detalhes' : 'Ver categorias de cookies'}
      </button>

      {/* ── Ações ─────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          onClick={() => save('necessary')}
          className={[
            'rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm',
            'text-ash hover:text-foreground hover:border-white/20 hover:bg-white/[0.07]',
            'transition-colors font-medium',
          ].join(' ')}
        >
          Apenas necessários
        </button>
        <button
          onClick={() => save('all')}
          className={[
            'rounded-lg bg-copper px-5 py-2 text-sm font-semibold text-ink',
            'hover:bg-copper/85 transition-colors',
          ].join(' ')}
        >
          Aceitar todos
        </button>
      </div>
    </div>
  );
}
