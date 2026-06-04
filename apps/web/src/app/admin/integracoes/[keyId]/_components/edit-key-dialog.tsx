'use client';

import { useState } from 'react';

import { Button } from '@szdevs/ui';

import type { ApiKey, IpBindingMode } from '@/lib/api-keys-api';

import { actionUpdateApiKey } from '../actions';

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

interface EditKeyDialogProps {
  apiKey: ApiKey;
}

export function EditKeyDialog({ apiKey }: EditKeyDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState(apiKey.name);
  const [rateLimitMin, setRateLimitMin] = useState(String(apiKey.rateLimit.perMinute));
  const [rateLimitHour, setRateLimitHour] = useState(String(apiKey.rateLimit.perHour));
  const [rateLimitDay, setRateLimitDay] = useState(String(apiKey.rateLimit.perDay));
  const [expiresAt, setExpiresAt] = useState(
    apiKey.expiresAt ? apiKey.expiresAt.split('T')[0] : '',
  );
  const [permissions, setPermissions] = useState<Set<string>>(new Set(apiKey.permissions));
  const [ipBinding, setIpBinding] = useState<IpBindingMode>(apiKey.ipBinding);
  const [boundIpsText, setBoundIpsText] = useState(apiKey.boundIps.join('\n'));

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

  function close(): void {
    setOpen(false);
    setError(null);
    setSuccess(false);
  }

  async function handleSave(): Promise<void> {
    setLoading(true);
    setError(null);

    const boundIps =
      ipBinding === 'MANUAL'
        ? boundIpsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    const res = await actionUpdateApiKey(apiKey.id, {
      name: name.trim(),
      permissions: Array.from(permissions),
      ipBinding,
      boundIps,
      rateLimit: {
        perMinute: parseInt(rateLimitMin || '60', 10),
        perHour: parseInt(rateLimitHour || '1000', 10),
        perDay: parseInt(rateLimitDay || '10000', 10),
      },
      expiresAt: expiresAt || undefined,
    });

    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setSuccess(true);
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        Editar
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-lg flex-col rounded-2xl border border-white/8 bg-white/[0.02] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground">
              Editar chave de API
            </h2>
            <p className="mt-0.5 text-xs text-ash">{apiKey.keyPrefix}</p>
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

        <div className="flex-1 overflow-y-auto p-6">
          {success ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                <span className="text-lg">✓</span> Chave atualizada com sucesso
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={close}>
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Nome */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ash">Nome da integração</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Rate limits */}
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

              {/* Expiração */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ash">Expiração (opcional)</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Permissões */}
              <div>
                <p className="mb-2 text-xs font-medium text-ash">Permissões</p>
                <div className="flex flex-col gap-3">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="mb-1 text-[11px] font-semibold text-foreground">
                        {group.label}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.perms.map((perm) => (
                          <label
                            key={perm}
                            className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs hover:bg-white/[0.05]"
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
              </div>

              {/* IP Binding */}
              <div>
                <p className="mb-2 text-xs font-medium text-ash">IP Binding</p>
                <div className="flex flex-col gap-2">
                  {(['AUTO', 'MANUAL', 'DISABLED'] as IpBindingMode[]).map((mode) => {
                    const labels: Record<IpBindingMode, string> = {
                      AUTO: 'AUTO',
                      MANUAL: 'MANUAL — lista específica',
                      DISABLED: 'DISABLED — sem restrição',
                    };
                    return (
                      <label
                        key={mode}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                          ipBinding === mode
                            ? 'border-sky-500/40 bg-sky-500/5 text-foreground'
                            : 'border-white/8 bg-white/[0.03] text-ash'
                        }`}
                      >
                        <input
                          type="radio"
                          name="editIpBinding"
                          value={mode}
                          checked={ipBinding === mode}
                          onChange={() => setIpBinding(mode)}
                          className="accent-sky-500"
                        />
                        {labels[mode]}
                      </label>
                    );
                  })}
                </div>

                {ipBinding === 'MANUAL' && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    <label className="text-[11px] text-ash">IPs permitidos (um por linha)</label>
                    <textarea
                      value={boundIpsText}
                      onChange={(e) => setBoundIpsText(e.target.value)}
                      rows={3}
                      className="rounded-lg border border-white/8 bg-background px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                )}
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={close}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={loading || !name.trim() || permissions.size === 0}
                  onClick={() => { void handleSave(); }}
                >
                  {loading ? 'Salvando…' : 'Salvar alterações'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
