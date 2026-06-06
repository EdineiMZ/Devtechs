'use client';

import { useState, useTransition } from 'react';

import { updateNotificationPreferences } from '@/lib/notifications-api';
import type { NotificationPreferences } from '@/lib/notifications-api';

interface PrefRow {
  key:   keyof NotificationPreferences['email'];
  label: string;
  desc:  string;
}

const PREF_ROWS: PrefRow[] = [
  {
    key:   'invoice',
    label: 'Faturas',
    desc:  'Nova cobrança gerada, fatura paga ou vencida.',
  },
  {
    key:   'subscription',
    label: 'Assinaturas',
    desc:  'Assinatura confirmada, próxima cobrança e cancelamento.',
  },
  {
    key:   'login',
    label: 'Login na conta',
    desc:  'Acesso detectado à sua conta (novo dispositivo ou localização).',
  },
  {
    key:   'accountChange',
    label: 'Alterações na conta',
    desc:  'Senha alterada, e-mail atualizado, 2FA ativado/desativado.',
  },
  {
    key:   'support',
    label: 'Suporte',
    desc:  'Resposta em ticket, mudança de status, resolução.',
  },
  {
    key:   'rh',
    label: 'RH',
    desc:  'Aprovação de férias, documentos, escalas.',
  },
  {
    key:   'system',
    label: 'Sistema',
    desc:  'Atualizações da plataforma, manutenções programadas.',
  },
];

// ── Toggle ─────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked:  boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
  label:    string;
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
        checked ? 'bg-copper' : 'bg-white/10'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-ink transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function NotificationPrefsForm({
  initial,
  accessToken,
}: {
  initial:     NotificationPreferences;
  accessToken: string;
}): JSX.Element {
  const [prefs, setPrefs]         = useState<NotificationPreferences>(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved]          = useState(false);
  const [error, setError]          = useState<string | null>(null);

  function setEmailPref(key: keyof NotificationPreferences['email'], val: boolean): void {
    setPrefs((p) => ({ ...p, email: { ...p.email, [key]: val } }));
    setSaved(false);
  }

  function setInappPref(key: keyof NotificationPreferences['inapp'], val: boolean): void {
    setPrefs((p) => ({ ...p, inapp: { ...p.inapp, [key]: val } }));
    setSaved(false);
  }

  async function save(): Promise<void> {
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const res = await updateNotificationPreferences(
        { email: prefs.email, inapp: prefs.inapp },
        accessToken,
      );
      if (res.ok) {
        setSaved(true);
      } else {
        const msg = res.data && 'message' in res.data
          ? String(res.data.message)
          : 'Falha ao salvar preferências';
        setError(msg);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.02]">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-white/8 bg-white/[0.03] px-6 py-3">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ash/50">
            Evento
          </span>
          <span className="w-16 text-center font-mono text-[10px] font-semibold uppercase tracking-widest text-ash/50">
            No app
          </span>
          <span className="w-16 text-center font-mono text-[10px] font-semibold uppercase tracking-widest text-ash/50">
            E-mail
          </span>
        </div>

        {/* Rows */}
        {PREF_ROWS.map((row, i) => (
          <div
            key={row.key}
            className={`grid grid-cols-[1fr_auto_auto] items-center gap-4 px-6 py-4 ${
              i < PREF_ROWS.length - 1 ? 'border-b border-white/5' : ''
            }`}
          >
            <div>
              <p className="font-body text-sm font-medium text-foreground">{row.label}</p>
              <p className="mt-0.5 font-body text-xs text-ash">{row.desc}</p>
            </div>
            <div className="flex w-16 justify-center">
              <Toggle
                checked={prefs.inapp[row.key]}
                disabled={pending}
                onChange={(v) => setInappPref(row.key, v)}
                label={`Notificação no app — ${row.label}`}
              />
            </div>
            <div className="flex w-16 justify-center">
              <Toggle
                checked={prefs.email[row.key]}
                disabled={pending}
                onChange={(v) => setEmailPref(row.key, v)}
                label={`Notificação por e-mail — ${row.label}`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Info note */}
      <p className="font-body text-xs text-ash/60">
        As notificações no app chegam em tempo real via WebSocket. As notificações por e-mail dependem do serviço de email configurado na plataforma.
      </p>

      {/* Save bar */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => void save()}
          disabled={pending}
          className="rounded-lg bg-copper px-5 py-2 font-body text-sm font-semibold text-ink transition-all hover:bg-copper/85 disabled:opacity-50"
        >
          {pending ? 'Salvando…' : 'Salvar preferências'}
        </button>

        {saved && !pending && (
          <span className="font-body text-sm text-acid">Preferências salvas ✓</span>
        )}
        {error && !pending && (
          <span className="font-body text-sm text-red-400">{error}</span>
        )}
      </div>
    </div>
  );
}
