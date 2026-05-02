'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmailProvider = 'resend' | 'gmail' | 'smtp';

export interface GmailSnapshot {
  user:            string | null;
  hasRefreshToken: boolean;
  clientIdHint:    string | null;
}

export interface SmtpSnapshot {
  host:    string | null;
  port:    string | null;
  user:    string | null;
  hasPass: boolean;
  from:    string | null;
}

export interface EmailProviderSnapshot {
  active: EmailProvider;
  gmail:  GmailSnapshot;
  smtp:   SmtpSnapshot;
}

export interface ApiKeyStatus {
  key:        string;
  label:      string;
  group:      string;
  configured: boolean;
  source:     'env' | 'redis' | 'unset';
  hint:       string | null;
}

export type PaymentProvider = 'mercadopago' | 'stripe';

export interface ConfigSnapshot {
  storage:         { provider: 'r2' | 'local'; source: 'redis' | 'env' };
  featureFlags:    Record<string, boolean>;
  env:             Record<string, string>;
  apiKeys:         ApiKeyStatus[];
  emailProvider:   EmailProviderSnapshot;
  paymentProvider: { active: PaymentProvider; source: 'redis' | 'env' };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Conflict descriptions for providers that can't coexist. */
const EMAIL_PROVIDER_CONFLICTS: Record<EmailProvider, string> = {
  resend: 'O Resend será o único provedor ativo. Gmail OAuth e SMTP serão ignorados.',
  gmail:  'O Gmail OAuth será o único provedor ativo. Resend e SMTP serão ignorados.',
  smtp:   'O SMTP será o único provedor ativo. Resend e Gmail OAuth serão ignorados.',
};

const EMAIL_PROVIDER_LABELS: Record<EmailProvider, string> = {
  resend: 'Resend',
  gmail:  'Gmail (OAuth2)',
  smtp:   'SMTP',
};

function SourceBadge({ source }: { source: ApiKeyStatus['source'] }): JSX.Element {
  if (source === 'redis') {
    return (
      <span className="rounded border border-copper/20 bg-copper/10 px-1.5 py-0.5 font-mono text-[9px] text-copper">
        redis
      </span>
    );
  }
  if (source === 'env') {
    return (
      <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-ash/60">
        env
      </span>
    );
  }
  return (
    <span className="rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 font-mono text-[9px] text-red-400">
      não definida
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConfigPanel({
  snapshot,
  error,
}: {
  snapshot: ConfigSnapshot | null;
  error:    string | null;
}): JSX.Element {
  const router                          = useRouter();
  const [pending, startTransition]      = useTransition();
  const [busy, setBusy]                 = useState<string | null>(null);
  const [gmailMsg, setGmailMsg]         = useState<string | null>(null);
  const [gmailError, setGmailError]     = useState<string | null>(null);
  const popupRef                        = useRef<Window | null>(null);

  // SMTP form state
  const [smtpDraft, setSmtpDraft] = useState({
    host: snapshot?.emailProvider.smtp.host ?? '',
    port: snapshot?.emailProvider.smtp.port ?? '587',
    user: snapshot?.emailProvider.smtp.user ?? '',
    pass: '',
    from: snapshot?.emailProvider.smtp.from ?? '',
  });
  const [smtpMsg, setSmtpMsg]     = useState<string | null>(null);
  const [smtpError, setSmtpError] = useState<string | null>(null);

  // Provider conflict pending confirmation
  const [pendingProvider, setPendingProvider] = useState<EmailProvider | null>(null);

  // Payment provider
  const [paymentProviderMsg, setPaymentProviderMsg] = useState<string | null>(null);

  // API key edit state
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [keyDraft, setKeyDraft]     = useState('');
  const [keyMsg, setKeyMsg]         = useState<string | null>(null);
  const [keyError, setKeyError]     = useState<string | null>(null);

  // ── Payment provider ───────────────────────────────────────────────────────

  async function setPaymentProviderFn(provider: PaymentProvider): Promise<void> {
    if (snapshot?.paymentProvider.active === provider) return;
    setBusy('payment-provider');
    setPaymentProviderMsg(null);
    try {
      const res = await fetch('/admin/developer/api/proxy/config/payment-provider', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        alert(body.message ?? 'Falha ao alterar provedor de pagamento');
      } else {
        setPaymentProviderMsg(`Provedor de pagamento alterado para ${provider === 'mercadopago' ? 'Mercado Pago' : 'Stripe'} ✓`);
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(null);
    }
  }

  // ── Storage ────────────────────────────────────────────────────────────────

  async function setStorage(provider: 'r2' | 'local'): Promise<void> {
    setBusy('storage');
    try {
      const res = await fetch('/admin/developer/api/proxy/config/storage', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        alert(body.message ?? 'Falha ao alterar storage');
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  // ── Feature flags ──────────────────────────────────────────────────────────

  async function toggleFlag(flag: string, current: boolean): Promise<void> {
    setBusy(flag);
    try {
      const res = await fetch(
        `/admin/developer/api/proxy/config/feature-flags/${encodeURIComponent(flag)}`,
        {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ enabled: !current }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        alert(body.message ?? 'Falha ao alterar flag');
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  // ── Email provider ─────────────────────────────────────────────────────────

  /** User clicks a provider button → show conflict banner first, then confirm. */
  function requestProviderSwitch(p: EmailProvider): void {
    if (snapshot?.emailProvider.active === p) return;
    setPendingProvider(p);
  }

  async function confirmProviderSwitch(): Promise<void> {
    if (!pendingProvider) return;
    const p = pendingProvider;
    setPendingProvider(null);
    setBusy('email-provider');
    try {
      const res = await fetch('/admin/developer/api/proxy/config/email-provider', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ provider: p }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        alert(body.message ?? 'Falha ao alterar provedor');
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  // ── SMTP credentials ───────────────────────────────────────────────────────

  async function saveSmtp(): Promise<void> {
    setSmtpMsg(null);
    setSmtpError(null);
    setBusy('smtp-save');
    try {
      const res = await fetch('/admin/developer/api/proxy/config/email-provider/smtp/credentials', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(smtpDraft),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        setSmtpError(body.message ?? 'Falha ao salvar SMTP');
      } else {
        setSmtpMsg('Credenciais SMTP salvas ✓');
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(null);
    }
  }

  // ── Gmail OAuth ────────────────────────────────────────────────────────────

  async function authorizeGmail(): Promise<void> {
    setGmailMsg(null);
    setGmailError(null);
    setBusy('gmail-auth');
    try {
      const redirectUri = `${window.location.origin}/admin/developer/gmail/callback`;
      const res = await fetch(
        `/admin/developer/api/proxy/config/email-provider/gmail/auth-url?redirectUri=${encodeURIComponent(redirectUri)}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        setGmailError(body.message ?? 'Falha ao gerar URL de autorização');
        return;
      }
      const { url } = await res.json() as { url: string };
      const popup = window.open(url, 'gmail-oauth', 'width=600,height=700,left=200,top=100');
      popupRef.current = popup;
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    function onMessage(ev: MessageEvent): void {
      if (typeof ev.data !== 'object' || !ev.data?.type?.startsWith('gmail-auth')) return;
      popupRef.current?.close();
      popupRef.current = null;
      if (ev.data.type === 'gmail-auth-success') {
        setGmailMsg(`Gmail autorizado para ${ev.data.user ?? 'conta Google'} ✓`);
        startTransition(() => router.refresh());
      } else {
        setGmailError(`Erro na autorização: ${ev.data.error ?? 'desconhecido'}`);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [router]);

  // ── API Keys ───────────────────────────────────────────────────────────────

  function startEditKey(key: ApiKeyStatus): void {
    setEditingKey(key.key);
    setKeyDraft('');
    setKeyMsg(null);
    setKeyError(null);
  }

  async function saveApiKey(keyName: string): Promise<void> {
    setBusy(`apikey-${keyName}`);
    setKeyMsg(null);
    setKeyError(null);
    try {
      const res = await fetch(
        `/admin/developer/api/proxy/config/api-keys/${encodeURIComponent(keyName)}`,
        {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ value: keyDraft }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        setKeyError(body.message ?? 'Falha ao salvar');
      } else {
        setKeyMsg(`${keyName} salvo ✓`);
        setEditingKey(null);
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(null);
    }
  }

  async function clearApiKey(keyName: string): Promise<void> {
    if (!window.confirm(`Remover override Redis para ${keyName}? O valor do .env será usado.`)) return;
    setBusy(`apikey-${keyName}`);
    try {
      await fetch(
        `/admin/developer/api/proxy/config/api-keys/${encodeURIComponent(keyName)}`,
        {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ value: '' }),
        },
      );
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  const apiKeyGroups = snapshot?.apiKeys
    ? Array.from(new Set(snapshot.apiKeys.map((k) => k.group))).map((group) => ({
        group,
        keys: snapshot.apiKeys.filter((k) => k.group === group),
      }))
    : [];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <header className="mb-8">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-copper">
          {'// developer / config'}
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">
          Configurações da Plataforma
        </h1>
        <p className="mt-1 font-body text-sm text-ash">
          API keys, provedores de email, storage, feature flags e variáveis de ambiente
        </p>
      </header>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 font-body text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {snapshot ? (
        <div className="space-y-6">

          {/* ── Integration overview ── */}
          <section className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
            <h2 className="mb-1 font-display text-sm font-semibold text-foreground">
              Status das Integrações
            </h2>
            <p className="mb-4 font-body text-sm text-ash">
              Visão geral de todas as integrações externas configuradas.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {apiKeyGroups.map(({ group, keys }) => {
                const allSet  = keys.every((k) => k.configured);
                const someSet = keys.some((k) => k.configured);
                return (
                  <div key={group} className="rounded-lg border border-white/8 bg-white/[0.02] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-display text-xs font-semibold text-foreground">{group}</p>
                      {allSet ? (
                        <span className="rounded border border-acid/20 bg-acid/10 px-1.5 py-0.5 font-mono text-[9px] text-acid">OK</span>
                      ) : someSet ? (
                        <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] text-amber-400">parcial</span>
                      ) : (
                        <span className="rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 font-mono text-[9px] text-red-400">não config.</span>
                      )}
                    </div>
                    <ul className="space-y-1">
                      {keys.map((k) => (
                        <li key={k.key} className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${k.configured ? 'bg-acid' : 'bg-red-400'}`} />
                          <span className="font-mono text-[10px] text-ash/70">{k.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Email provider ── */}
          <section className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
            <h2 className="mb-1 font-display text-sm font-semibold text-foreground">
              Provedor de Email
            </h2>
            <p className="mb-4 font-body text-sm text-ash">
              Apenas um provedor pode estar ativo por vez. Trocar de provedor desativa os demais imediatamente.
            </p>

            {/* Provider selector */}
            <div className="mb-5 flex gap-3">
              {(['resend', 'gmail', 'smtp'] as const).map((p) => {
                const active = snapshot.emailProvider.active === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => requestProviderSwitch(p)}
                    disabled={busy === 'email-provider' || pending || active}
                    className={`flex-1 rounded-lg border px-4 py-3 font-body text-sm font-medium transition-colors disabled:opacity-50 ${
                      active
                        ? 'border-copper/40 bg-copper/10 text-copper'
                        : 'border-white/8 bg-white/[0.02] text-ash hover:border-copper/20 hover:text-foreground'
                    }`}
                  >
                    {EMAIL_PROVIDER_LABELS[p]}
                    {active ? ' · ativo' : ''}
                  </button>
                );
              })}
            </div>

            {/* Conflict confirmation dialog */}
            {pendingProvider && (
              <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/8 p-4">
                <div className="mb-3 flex items-start gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-400">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <div>
                    <p className="font-body text-sm font-semibold text-amber-300">
                      Trocar para {EMAIL_PROVIDER_LABELS[pendingProvider]}?
                    </p>
                    <p className="mt-0.5 font-body text-xs text-amber-300/80">
                      {EMAIL_PROVIDER_CONFLICTS[pendingProvider]}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void confirmProviderSwitch()}
                    disabled={busy === 'email-provider' || pending}
                    className="rounded-lg bg-amber-500/20 px-4 py-1.5 font-body text-sm font-medium text-amber-300 hover:bg-amber-500/30 disabled:opacity-50"
                  >
                    Confirmar troca
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingProvider(null)}
                    className="rounded-lg border border-white/8 px-4 py-1.5 font-body text-sm text-ash hover:border-white/20"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* ── Resend config ── */}
            {snapshot.emailProvider.active === 'resend' && (
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
                <p className="mb-2 font-display text-xs font-semibold text-foreground">Configuração Resend</p>
                <p className="mb-3 font-body text-xs text-ash">
                  Defina a chave API do Resend na seção <span className="text-copper">Chaves de API → Email — Resend</span> abaixo.
                </p>
                {snapshot.apiKeys.find((k) => k.key === 'RESEND_API_KEY')?.configured ? (
                  <span className="rounded border border-acid/20 bg-acid/10 px-2 py-0.5 font-mono text-[10px] text-acid">
                    API key configurada ✓
                  </span>
                ) : (
                  <span className="rounded border border-red-500/20 bg-red-500/10 px-2 py-0.5 font-mono text-[10px] text-red-400">
                    RESEND_API_KEY não definida
                  </span>
                )}
              </div>
            )}

            {/* ── SMTP config ── */}
            {snapshot.emailProvider.active === 'smtp' && (
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="font-display text-xs font-semibold text-foreground">Configuração SMTP</p>
                    <p className="font-body text-xs text-ash">
                      As credenciais ficam no Redis (sem restart). Fallback: variáveis de ambiente.
                    </p>
                  </div>
                  {snapshot.emailProvider.smtp.host && (
                    <span className="rounded border border-acid/20 bg-acid/10 px-2 py-0.5 font-mono text-[10px] text-acid">
                      configurado
                    </span>
                  )}
                </div>

                {/* Current SMTP status */}
                <dl className="mb-4 space-y-2">
                  {[
                    { label: 'Host',  value: snapshot.emailProvider.smtp.host },
                    { label: 'Porta', value: snapshot.emailProvider.smtp.port },
                    { label: 'User',  value: snapshot.emailProvider.smtp.user },
                    { label: 'Senha', value: snapshot.emailProvider.smtp.hasPass ? '••••••••' : null },
                    { label: 'From',  value: snapshot.emailProvider.smtp.from },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between">
                      <dt className="font-mono text-xs text-ash/50">{label}</dt>
                      <dd className="font-mono text-xs text-ash">{value ?? '—'}</dd>
                    </div>
                  ))}
                </dl>

                {/* SMTP edit form */}
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block font-mono text-[10px] text-ash/50">Host</label>
                      <input
                        type="text"
                        value={smtpDraft.host}
                        onChange={(e) => setSmtpDraft((d) => ({ ...d, host: e.target.value }))}
                        placeholder="smtp.gmail.com"
                        className="w-full rounded-lg border border-white/8 bg-ink px-3 py-2 font-mono text-xs text-foreground placeholder-ash/30 focus:border-copper/40 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-mono text-[10px] text-ash/50">Porta</label>
                      <input
                        type="text"
                        value={smtpDraft.port}
                        onChange={(e) => setSmtpDraft((d) => ({ ...d, port: e.target.value }))}
                        placeholder="587"
                        className="w-full rounded-lg border border-white/8 bg-ink px-3 py-2 font-mono text-xs text-foreground placeholder-ash/30 focus:border-copper/40 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] text-ash/50">Usuário</label>
                    <input
                      type="text"
                      value={smtpDraft.user}
                      onChange={(e) => setSmtpDraft((d) => ({ ...d, user: e.target.value }))}
                      placeholder="no-reply@exemplo.com"
                      className="w-full rounded-lg border border-white/8 bg-ink px-3 py-2 font-mono text-xs text-foreground placeholder-ash/30 focus:border-copper/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] text-ash/50">
                      Senha {snapshot.emailProvider.smtp.hasPass && '(deixe em branco para manter)'}
                    </label>
                    <input
                      type="password"
                      value={smtpDraft.pass}
                      onChange={(e) => setSmtpDraft((d) => ({ ...d, pass: e.target.value }))}
                      placeholder={snapshot.emailProvider.smtp.hasPass ? '••••••••' : 'Senha do SMTP'}
                      className="w-full rounded-lg border border-white/8 bg-ink px-3 py-2 font-mono text-xs text-foreground placeholder-ash/30 focus:border-copper/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] text-ash/50">From (remetente)</label>
                    <input
                      type="text"
                      value={smtpDraft.from}
                      onChange={(e) => setSmtpDraft((d) => ({ ...d, from: e.target.value }))}
                      placeholder='DevTechs <no-reply@exemplo.com>'
                      className="w-full rounded-lg border border-white/8 bg-ink px-3 py-2 font-mono text-xs text-foreground placeholder-ash/30 focus:border-copper/40 focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void saveSmtp()}
                    disabled={busy === 'smtp-save' || pending}
                    className="flex items-center gap-2 rounded-lg border border-copper/30 bg-copper/8 px-4 py-2 font-body text-sm font-medium text-copper transition-all hover:border-copper/50 hover:bg-copper/12 disabled:opacity-50"
                  >
                    {busy === 'smtp-save' ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-copper/20 border-t-copper" />
                    ) : null}
                    Salvar credenciais SMTP
                  </button>

                  {smtpMsg  && <p className="font-body text-xs text-acid">{smtpMsg}</p>}
                  {smtpError && <p className="font-body text-xs text-red-400">{smtpError}</p>}
                </div>
              </div>
            )}

            {/* ── Gmail config ── */}
            {snapshot.emailProvider.active === 'gmail' && (
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="font-display text-xs font-semibold text-foreground">Configuração Gmail</p>
                    <p className="font-body text-xs text-ash">
                      Autorize uma conta Google para enviar e-mails via Gmail API (escopo gmail.send).
                    </p>
                  </div>
                  {snapshot.emailProvider.gmail.hasRefreshToken && (
                    <span className="rounded border border-acid/20 bg-acid/10 px-2 py-0.5 font-mono text-[10px] text-acid">
                      autorizado
                    </span>
                  )}
                </div>

                <dl className="mb-4 space-y-2">
                  <div className="flex justify-between">
                    <dt className="font-mono text-xs text-ash/50">Conta remetente</dt>
                    <dd className="font-body text-xs text-foreground">{snapshot.emailProvider.gmail.user ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-mono text-xs text-ash/50">Client ID</dt>
                    <dd className="font-mono text-xs text-ash">{snapshot.emailProvider.gmail.clientIdHint ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-mono text-xs text-ash/50">Refresh token</dt>
                    <dd className="font-mono text-xs text-ash">
                      {snapshot.emailProvider.gmail.hasRefreshToken ? '••••••••' : '—'}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={() => void authorizeGmail()}
                  disabled={busy === 'gmail-auth' || pending}
                  className="flex items-center gap-2 rounded-lg border border-copper/30 bg-copper/8 px-4 py-2 font-body text-sm font-medium text-copper transition-all hover:border-copper/50 hover:bg-copper/12 disabled:opacity-50"
                >
                  {busy === 'gmail-auth' ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-copper/20 border-t-copper" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  {snapshot.emailProvider.gmail.hasRefreshToken ? 'Reautorizar Gmail' : 'Autorizar Gmail'}
                </button>

                {gmailMsg  && <p className="mt-3 font-body text-xs text-acid">{gmailMsg}</p>}
                {gmailError && <p className="mt-3 font-body text-xs text-red-400">{gmailError}</p>}

                <p className="mt-3 font-mono text-[10px] text-ash/40">
                  Redirect URI: <span className="text-ash/60">
                    {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}
                    /admin/developer/gmail/callback
                  </span>
                </p>
              </div>
            )}
          </section>

          {/* ── API Keys ── */}
          <section className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
            <h2 className="mb-1 font-display text-sm font-semibold text-foreground">Chaves de API</h2>
            <p className="mb-4 font-body text-sm text-ash">
              Overrides armazenados no Redis (sem restart). O valor do{' '}
              <code className="font-mono text-xs text-copper">.env</code> é usado como fallback.
            </p>

            {keyMsg   && <p className="mb-3 font-body text-xs text-acid">{keyMsg}</p>}
            {keyError && <p className="mb-3 font-body text-xs text-red-400">{keyError}</p>}

            <div className="space-y-6">
              {apiKeyGroups.map(({ group, keys }) => (
                <div key={group}>
                  <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-copper/70">
                    {group}
                  </p>
                  <div className="space-y-2">
                    {keys.map((apiKey) => (
                      <div key={apiKey.key} className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <code className="font-mono text-xs text-foreground">{apiKey.key}</code>
                              <SourceBadge source={apiKey.source} />
                            </div>
                            {apiKey.hint && editingKey !== apiKey.key && (
                              <p className="mt-0.5 font-mono text-[10px] text-ash/50">{apiKey.hint}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {apiKey.source === 'redis' && editingKey !== apiKey.key && (
                              <button
                                type="button"
                                onClick={() => void clearApiKey(apiKey.key)}
                                disabled={busy === `apikey-${apiKey.key}` || pending}
                                className="rounded border border-red-500/20 bg-red-500/10 px-2 py-1 font-mono text-[10px] text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                              >
                                limpar
                              </button>
                            )}
                            {editingKey !== apiKey.key && (
                              <button
                                type="button"
                                onClick={() => startEditKey(apiKey)}
                                disabled={pending}
                                className="rounded border border-copper/20 bg-copper/8 px-2 py-1 font-mono text-[10px] text-copper hover:border-copper/40 hover:bg-copper/12 disabled:opacity-50"
                              >
                                {apiKey.configured ? 'alterar' : 'definir'}
                              </button>
                            )}
                          </div>
                        </div>

                        {editingKey === apiKey.key && (
                          <div className="mt-3 flex items-center gap-2">
                            <input
                              type="password"
                              autoFocus
                              value={keyDraft}
                              onChange={(e) => setKeyDraft(e.target.value)}
                              placeholder={`Novo valor para ${apiKey.key}`}
                              className="flex-1 rounded-lg border border-white/8 bg-ink px-3 py-2 font-mono text-xs text-foreground placeholder-ash/30 focus:border-copper/40 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => void saveApiKey(apiKey.key)}
                              disabled={!keyDraft || busy === `apikey-${apiKey.key}` || pending}
                              className="rounded-lg border border-copper/30 bg-copper/8 px-3 py-2 font-mono text-xs text-copper hover:border-copper/50 hover:bg-copper/12 disabled:opacity-50"
                            >
                              {busy === `apikey-${apiKey.key}` ? '…' : 'salvar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingKey(null)}
                              className="rounded-lg border border-white/8 px-3 py-2 font-mono text-xs text-ash hover:border-white/20"
                            >
                              cancelar
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Payment provider ── */}
          <section className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
            <h2 className="mb-1 font-display text-sm font-semibold text-foreground">Provedor de Pagamento</h2>
            <p className="mb-4 font-body text-sm text-ash">
              Define qual gateway processa cobranças. Apenas um pode estar ativo por vez.
              Origem:{' '}
              <code className="font-mono text-xs text-copper">{snapshot.paymentProvider.source}</code>
            </p>
            <div className="flex gap-3">
              {(['mercadopago', 'stripe'] as const).map((p) => {
                const active = snapshot.paymentProvider.active === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => void setPaymentProviderFn(p)}
                    disabled={busy === 'payment-provider' || pending || active}
                    className={`flex-1 rounded-lg border px-4 py-3 font-body text-sm font-medium transition-colors disabled:opacity-50 ${
                      active
                        ? 'border-copper/40 bg-copper/10 text-copper'
                        : 'border-white/8 bg-white/[0.02] text-ash hover:border-copper/20 hover:text-foreground'
                    }`}
                  >
                    {p === 'mercadopago' ? 'Mercado Pago' : 'Stripe'}
                    {active ? ' · ativo' : ''}
                  </button>
                );
              })}
            </div>
            {paymentProviderMsg && (
              <p className="mt-3 font-body text-xs text-acid">{paymentProviderMsg}</p>
            )}

            {/* Provider-specific key status */}
            <div className="mt-4 rounded-lg border border-white/8 bg-white/[0.02] p-4">
              {snapshot.paymentProvider.active === 'mercadopago' ? (
                <>
                  <p className="mb-2 font-display text-xs font-semibold text-foreground">Credenciais Mercado Pago</p>
                  <p className="mb-3 font-body text-xs text-ash">
                    Defina as chaves na seção <span className="text-copper">Chaves de API → Mercado Pago</span> abaixo.
                    Para testes use tokens de sandbox do{' '}
                    <span className="text-copper">developers.mercadopago.com</span>.
                  </p>
                  <div className="space-y-1">
                    {['MP_ACCESS_TOKEN', 'MP_PUBLIC_KEY', 'MP_WEBHOOK_SECRET'].map((k) => {
                      const s = snapshot.apiKeys.find((a) => a.key === k);
                      return (
                        <div key={k} className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${s?.configured ? 'bg-acid' : 'bg-red-400'}`} />
                          <code className="font-mono text-[10px] text-ash/70">{k}</code>
                          {s?.hint && <span className="font-mono text-[10px] text-ash/40">{s.hint}</span>}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-2 font-display text-xs font-semibold text-foreground">Credenciais Stripe</p>
                  <p className="mb-3 font-body text-xs text-ash">
                    Defina as chaves na seção <span className="text-copper">Chaves de API → Stripe (Pagamentos)</span> abaixo.
                    Para testes use as chaves <span className="text-copper">sk_test_*</span> e <span className="text-copper">pk_test_*</span>.
                  </p>
                  <div className="space-y-1">
                    {['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'].map((k) => {
                      const s = snapshot.apiKeys.find((a) => a.key === k);
                      return (
                        <div key={k} className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${s?.configured ? 'bg-acid' : 'bg-red-400'}`} />
                          <code className="font-mono text-[10px] text-ash/70">{k}</code>
                          {s?.hint && <span className="font-mono text-[10px] text-ash/40">{s.hint}</span>}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* ── Storage provider ── */}
          <section className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
            <h2 className="mb-1 font-display text-sm font-semibold text-foreground">Storage Provider</h2>
            <p className="mb-4 font-body text-sm text-ash">
              Define onde uploads são armazenados. Origem:{' '}
              <code className="font-mono text-xs text-copper">{snapshot.storage.source}</code>
            </p>
            <div className="flex gap-3">
              {(['local', 'r2'] as const).map((p) => {
                const active = snapshot.storage.provider === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => void setStorage(p)}
                    disabled={busy === 'storage' || pending || active}
                    className={`flex-1 rounded-lg border px-4 py-3 font-body text-sm font-medium transition-colors disabled:opacity-50 ${
                      active
                        ? 'border-copper/40 bg-copper/10 text-copper'
                        : 'border-white/8 bg-white/[0.02] text-ash hover:border-copper/20 hover:text-foreground'
                    }`}
                  >
                    {p === 'local' ? 'Filesystem local' : 'Cloudflare R2'}
                    {active ? ' · ativo' : ''}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Feature flags ── */}
          <section className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
            <h2 className="mb-1 font-display text-sm font-semibold text-foreground">Feature Flags</h2>
            <p className="mb-4 font-body text-sm text-ash">
              Toggles dinâmicos. Overrides em Redis sobrescrevem os defaults do{' '}
              <code className="font-mono text-xs text-copper">.env</code>.
            </p>
            {Object.keys(snapshot.featureFlags).length === 0 ? (
              <p className="font-body text-sm italic text-ash/60">
                Nenhuma flag definida. Adicione variáveis com prefixo{' '}
                <code className="font-mono text-xs text-copper">FEATURE_</code> no{' '}
                <code className="font-mono text-xs text-copper">.env</code>.
              </p>
            ) : (
              <div className="space-y-2">
                {Object.entries(snapshot.featureFlags).map(([flag, enabled]) => (
                  <div key={flag} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] p-3">
                    <code className="font-mono text-xs text-foreground">{flag}</code>
                    <button
                      type="button"
                      onClick={() => void toggleFlag(flag, enabled)}
                      disabled={busy === flag || pending}
                      aria-label={`Toggle ${flag}`}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        enabled ? 'bg-copper' : 'bg-white/10'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-ink transition-transform ${
                        enabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Env vars ── */}
          <section className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
            <h2 className="mb-1 font-display text-sm font-semibold text-foreground">
              Variáveis CONFIG_* / FEATURE_*
            </h2>
            <p className="mb-4 font-body text-sm text-ash">
              Variáveis não-sensíveis expostas pelo serviço developer.
            </p>
            {Object.keys(snapshot.env).length === 0 ? (
              <p className="font-body text-sm italic text-ash/60">Nenhuma variável.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(snapshot.env).map(([key, value]) => (
                    <tr key={key} className="border-b border-white/5 last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs text-copper">{key}</td>
                      <td className="max-w-md truncate py-2 font-mono text-xs text-ash">{value || '(vazio)'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

        </div>
      ) : null}
    </>
  );
}
