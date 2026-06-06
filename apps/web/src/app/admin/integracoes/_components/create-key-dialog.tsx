'use client';

import { useState } from 'react';

import { Button } from '@szdevs/ui';

import type { IpBindingMode, RateLimit, ApiKey } from '@/lib/api-keys-api';

import { actionCreateApiKey } from '../actions';

type Step = 'info' | 'permissoes' | 'ip' | 'resultado';

interface PermissionGroup {
  label: string;
  perms: string[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  { label: 'Tickets', perms: ['tickets:read', 'tickets:write', 'tickets:status'] },
  { label: 'Projetos', perms: ['projects:read', 'projects:write'] },
  { label: 'Financeiro', perms: ['finance:read', 'finance:write'] },
  { label: 'RH', perms: ['hr:read'] },
  { label: 'DevOps', perms: ['devops:read', 'devops:trigger'] },
  { label: 'Auditoria', perms: ['audit:read'] },
];

function CopyButton({ value }: { value: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  function copy(): void {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="ml-2 rounded px-2 py-0.5 text-xs text-sky-400 hover:text-sky-300"
    >
      {copied ? '✓ Copiado' : 'Copiar'}
    </button>
  );
}

interface CreateResult {
  ok: boolean;
  message: string;
  key?: string;
  apiKey?: ApiKey;
}

const STEP_LABELS: Record<Step, string> = {
  info: '1. Informações básicas',
  permissoes: '2. Permissões',
  ip: '3. IP Binding',
  resultado: '4. Resultado',
};

const STEPS: Step[] = ['info', 'permissoes', 'ip', 'resultado'];

export function CreateKeyDialog(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — info
  const [name, setName] = useState('');
  const [rateLimitMin, setRateLimitMin] = useState('60');
  const [rateLimitHour, setRateLimitHour] = useState('1000');
  const [rateLimitDay, setRateLimitDay] = useState('10000');
  const [expiresAt, setExpiresAt] = useState('');

  // Step 2 — permissions
  const [permissions, setPermissions] = useState<Set<string>>(new Set());

  // Step 3 — ip binding
  const [ipBinding, setIpBinding] = useState<IpBindingMode>('AUTO');
  const [boundIpsText, setBoundIpsText] = useState('');

  // Step 4 — result
  const [result, setResult] = useState<CreateResult | null>(null);

  function togglePermission(perm: string): void {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) {
        next.delete(perm);
      } else {
        next.add(perm);
      }
      return next;
    });
  }

  function reset(): void {
    setStep('info');
    setName('');
    setRateLimitMin('60');
    setRateLimitHour('1000');
    setRateLimitDay('10000');
    setExpiresAt('');
    setPermissions(new Set());
    setIpBinding('AUTO');
    setBoundIpsText('');
    setResult(null);
    setError(null);
  }

  function close(): void {
    setOpen(false);
    reset();
  }

  async function handleSubmit(): Promise<void> {
    setLoading(true);
    setError(null);

    const rateLimit: RateLimit = {
      perMinute: parseInt(rateLimitMin || '60', 10),
      perHour: parseInt(rateLimitHour || '1000', 10),
      perDay: parseInt(rateLimitDay || '10000', 10),
    };

    const boundIps =
      ipBinding === 'MANUAL'
        ? boundIpsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const res = await actionCreateApiKey({
      name: name.trim(),
      permissions: Array.from(permissions),
      ipBinding,
      boundIps,
      rateLimit,
      expiresAt: expiresAt || undefined,
    });

    setLoading(false);
    setResult(res);
    setStep('resultado');
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        + Nova Integração
      </Button>
    );
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-lg flex-col rounded-2xl border border-white/8 bg-white/[0.02] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground">
              Nova Integração
            </h2>
            <p className="mt-0.5 text-xs text-ash">{STEP_LABELS[step]}</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="text-ash hover:text-foreground"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex border-b border-white/8 px-6 py-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  s === step
                    ? 'bg-sky-500 text-white'
                    : i < stepIndex
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'bg-white/5 text-ash'
                }`}
              >
                {i + 1}
              </span>
              {i < STEPS.length - 1 && <div className="mx-1 h-px w-6 bg-border/40" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* ── Step 1: Info básica ──────────────────────────────────────── */}
          {step === 'info' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ash">Nome da integração *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: Webhook Suporte Externo"
                  maxLength={120}
                  required
                  className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-ash">Rate Limit</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] text-ash">Por minuto</label>
                    <input
                      type="number"
                      value={rateLimitMin}
                      onChange={(e) => setRateLimitMin(e.target.value)}
                      min={1}
                      className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] text-ash">Por hora</label>
                    <input
                      type="number"
                      value={rateLimitHour}
                      onChange={(e) => setRateLimitHour(e.target.value)}
                      min={1}
                      className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] text-ash">Por dia</label>
                    <input
                      type="number"
                      value={rateLimitDay}
                      onChange={(e) => setRateLimitDay(e.target.value)}
                      min={1}
                      className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ash">
                  Expiração (opcional)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <p className="text-[11px] text-ash">Deixe em branco para sem expiração.</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={close}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={!name.trim()}
                  onClick={() => setStep('permissoes')}
                >
                  Próximo
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 2: Permissões ───────────────────────────────────────── */}
          {step === 'permissoes' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-ash">
                Selecione as permissões que esta chave de API terá acesso.
              </p>

              <div className="flex flex-col gap-4">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="mb-1.5 text-xs font-semibold text-foreground">{group.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.perms.map((perm) => (
                        <label
                          key={perm}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-xs hover:bg-white/[0.05]"
                        >
                          <input
                            type="checkbox"
                            checked={permissions.has(perm)}
                            onChange={() => togglePermission(perm)}
                            className="accent-sky-500"
                          />
                          <code className="font-mono text-ash">{perm}</code>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {permissions.size === 0 && (
                <p className="text-xs text-amber-400">
                  Selecione ao menos uma permissão.
                </p>
              )}

              <div className="flex justify-between gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setStep('info')}>
                  Voltar
                </Button>
                <Button
                  type="button"
                  disabled={permissions.size === 0}
                  onClick={() => setStep('ip')}
                >
                  Próximo
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3: IP Binding ───────────────────────────────────────── */}
          {step === 'ip' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-ash">
                Defina como o IP do solicitante será validado para esta chave.
              </p>

              <div className="flex flex-col gap-2">
                {(['AUTO', 'MANUAL', 'DISABLED'] as IpBindingMode[]).map((mode) => {
                  const labels: Record<IpBindingMode, string> = {
                    AUTO: 'AUTO — Vincula automaticamente ao primeiro IP que usar a chave',
                    MANUAL: 'MANUAL — Restringir a uma lista específica de IPs',
                    DISABLED: 'DISABLED — Sem restrição de IP',
                  };
                  return (
                    <label
                      key={mode}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
                        ipBinding === mode
                          ? 'border-sky-500/40 bg-sky-500/5'
                          : 'border-white/8 bg-white/[0.03]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="ipBinding"
                        value={mode}
                        checked={ipBinding === mode}
                        onChange={() => setIpBinding(mode)}
                        className="mt-0.5 accent-sky-500"
                      />
                      <span className="text-sm text-foreground">{labels[mode]}</span>
                    </label>
                  );
                })}
              </div>

              {ipBinding === 'MANUAL' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ash">
                    Lista de IPs permitidos (um por linha)
                  </label>
                  <textarea
                    value={boundIpsText}
                    onChange={(e) => setBoundIpsText(e.target.value)}
                    rows={4}
                    placeholder={'192.168.1.1\n10.0.0.100'}
                    className="rounded-lg border border-white/8 bg-background px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              )}

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <div className="flex justify-between gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setStep('permissoes')}>
                  Voltar
                </Button>
                <Button
                  type="button"
                  disabled={
                    loading ||
                    (ipBinding === 'MANUAL' &&
                      !boundIpsText.split('\n').some((s) => s.trim()))
                  }
                  onClick={() => { void handleSubmit(); }}
                >
                  {loading ? 'Criando…' : 'Criar chave'}
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 4: Resultado ────────────────────────────────────────── */}
          {step === 'resultado' && result && (
            <div className="flex flex-col gap-4">
              {result.ok && result.key ? (
                <>
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                    <span className="text-lg">✓</span> Chave criada com sucesso
                  </div>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
                    <strong>Esta chave será exibida apenas uma vez.</strong> Copie e guarde em
                    local seguro. Após fechar este painel não será possível recuperá-la.
                  </div>

                  <div className="flex flex-col gap-2 rounded-xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-ash">
                      Chave de API
                    </p>
                    <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-background px-3 py-2">
                      <code className="flex-1 break-all font-mono text-xs text-foreground">
                        {result.key}
                      </code>
                      <CopyButton value={result.key} />
                    </div>
                  </div>

                  {result.apiKey && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div>
                        <span className="text-ash">Prefixo:</span>{' '}
                        <code className="font-mono text-foreground">{result.apiKey.keyPrefix}</code>
                      </div>
                      <div>
                        <span className="text-ash">Status:</span>{' '}
                        <span className="text-emerald-400">{result.apiKey.status}</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                  <p className="font-semibold">Erro ao criar chave</p>
                  <p className="mt-1">{result.message}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                {result.ok ? (
                  <>
                    <Button type="button" variant="ghost" onClick={reset}>
                      Criar outra
                    </Button>
                    <Button type="button" onClick={close}>
                      Fechar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="ghost" onClick={() => setStep('ip')}>
                      Tentar novamente
                    </Button>
                    <Button type="button" onClick={close}>
                      Fechar
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
