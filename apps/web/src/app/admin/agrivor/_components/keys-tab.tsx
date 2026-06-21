'use client';

import { Badge, Button, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@szdevs/ui';
import { useCallback, useEffect, useState } from 'react';

import type { AgrivorKey, AgrivorKeyStatus } from '@/lib/agrivor-api';

const STATUS_VARIANT: Record<AgrivorKeyStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  ACTIVE: 'success',
  EXPIRED: 'warning',
  REVOKED: 'destructive',
  PENDING: 'secondary',
};

const STATUS_LABEL: Record<AgrivorKeyStatus, string> = {
  ACTIVE: 'Ativo',
  EXPIRED: 'Expirado',
  REVOKED: 'Revogado',
  PENDING: 'Pendente',
};

const AGRIVOR_MODULES = ['financeiro', 'lavoura', 'rebanho', 'estoque', 'crm', 'nf', 'relatorios', 'ia'];

function fmtRelative(iso: string | null): string {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function Toast({ message, tone }: { message: string; tone: 'success' | 'error' }): JSX.Element {
  return (
    <div
      role="status"
      className={
        'rounded-lg border p-3 text-sm ' +
        (tone === 'success'
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          : 'border-red-500/40 bg-red-500/10 text-red-300')
      }
    >
      {message}
    </div>
  );
}

function IssueKeyModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}): JSX.Element {
  const [customerId, setCustomerId] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(): Promise<void> {
    if (!customerId.trim() || selectedModules.length === 0) {
      setError('Preencha o Customer ID e selecione ao menos um módulo.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/agrivor/keys/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerId.trim(),
          modules: selectedModules,
          expiresInDays: expiresInDays ? parseInt(expiresInDays, 10) : undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? 'Erro ao emitir key.');
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setError('Falha de conexão.');
    } finally {
      setLoading(false);
    }
  }

  function toggleModule(mod: string): void {
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-md flex-col rounded-2xl border border-white/8 bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <h2 className="text-base font-bold text-foreground">Emitir Key AGRIVOR</h2>
          <button type="button" onClick={onClose} className="text-ash hover:text-foreground" aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ash">Customer ID *</label>
            <input
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="ex: cliente-123"
              className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ash">Módulos *</label>
            <div className="flex flex-wrap gap-2">
              {AGRIVOR_MODULES.map((mod) => (
                <button
                  key={mod}
                  type="button"
                  onClick={() => toggleModule(mod)}
                  className={
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                    (selectedModules.includes(mod)
                      ? 'border-sky-500 bg-sky-500/20 text-sky-300'
                      : 'border-white/8 text-ash hover:border-white/20 hover:text-foreground')
                  }
                >
                  {mod}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ash">Validade (dias)</label>
            <input
              type="number"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              placeholder="Sem expiração"
              min={1}
              className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="button" disabled={loading} onClick={() => { void handleSubmit(); }}>
              {loading ? 'Emitindo…' : 'Emitir Key'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RenewKeyModal({
  keyId,
  onClose,
  onSuccess,
}: {
  keyId: string;
  onClose: () => void;
  onSuccess: () => void;
}): JSX.Element {
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(): Promise<void> {
    const days = parseInt(expiresInDays, 10);
    if (!days || days < 1) {
      setError('Informe um número de dias válido.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/agrivor/keys/${keyId}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInDays: days }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? 'Erro ao renovar key.');
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setError('Falha de conexão.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-sm flex-col rounded-2xl border border-white/8 bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <h2 className="text-base font-bold text-foreground">Renovar Key</h2>
          <button type="button" onClick={onClose} className="text-ash hover:text-foreground" aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ash">Renovar por (dias) *</label>
            <input
              type="number"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              min={1}
              className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="button" disabled={loading} onClick={() => { void handleSubmit(); }}>
              {loading ? 'Renovando…' : 'Renovar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function KeysTab(): JSX.Element {
  const [keys, setKeys] = useState<AgrivorKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<AgrivorKeyStatus | ''>('');
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [renewKeyId, setRenewKeyId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  function showToast(tone: 'success' | 'error', message: string): void {
    setToast({ tone, message });
    setTimeout(() => setToast(null), 5000);
  }

  const loadKeys = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const url = statusFilter ? `/api/admin/agrivor/keys?status=${statusFilter}` : '/api/admin/agrivor/keys';
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as AgrivorKey[];
        setKeys(Array.isArray(data) ? data : []);
      }
    } catch {
      setToast({ tone: 'error', message: 'Falha ao carregar keys.' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function handleRevoke(id: string): Promise<void> {
    if (!confirm('Revogar esta key? Esta ação não pode ser desfeita.')) return;
    setRevoking(id);
    try {
      const res = await fetch(`/api/admin/agrivor/keys/${id}/revoke`, { method: 'DELETE' });
      if (res.ok) {
        showToast('success', 'Key revogada com sucesso.');
        void loadKeys();
      } else {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        showToast('error', data.message ?? 'Erro ao revogar key.');
      }
    } catch {
      showToast('error', 'Falha de conexão.');
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AgrivorKeyStatus | '')}
          className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativos</option>
          <option value="EXPIRED">Expirados</option>
          <option value="REVOKED">Revogados</option>
          <option value="PENDING">Pendentes</option>
        </select>
        <Button type="button" onClick={() => setShowIssueModal(true)}>
          + Emitir Key
        </Button>
      </div>

      {toast ? <Toast {...toast} /> : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" label="Carregando keys…" />
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] py-12 text-center text-sm text-ash">
          Nenhuma key encontrada.
        </div>
      ) : (
        <div className="rounded-xl border border-white/8 bg-white/[0.02]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Módulos</TableHead>
                <TableHead>Emitida em</TableHead>
                <TableHead>Expira em</TableHead>
                <TableHead>Último heartbeat</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-mono text-xs">{k.customerId}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[k.status]}>{STATUS_LABEL[k.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {k.modules.map((m) => (
                        <span
                          key={m}
                          className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] text-ash"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{fmtDate(k.createdAt)}</TableCell>
                  <TableCell className="text-sm">{fmtDate(k.expiresAt)}</TableCell>
                  <TableCell className="text-sm">{fmtRelative(k.lastHeartbeatAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {k.status !== 'REVOKED' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setRenewKeyId(k.id)}
                            className="text-xs text-sky-400 hover:text-sky-300"
                          >
                            Renovar
                          </button>
                          <button
                            type="button"
                            disabled={revoking === k.id}
                            onClick={() => { void handleRevoke(k.id); }}
                            className="text-xs text-destructive hover:text-red-400 disabled:opacity-50"
                          >
                            {revoking === k.id ? '…' : 'Revogar'}
                          </button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {showIssueModal && (
        <IssueKeyModal
          onClose={() => setShowIssueModal(false)}
          onSuccess={() => {
            showToast('success', 'Key emitida com sucesso.');
            void loadKeys();
          }}
        />
      )}

      {renewKeyId !== null && (
        <RenewKeyModal
          keyId={renewKeyId}
          onClose={() => setRenewKeyId(null)}
          onSuccess={() => {
            showToast('success', 'Key renovada com sucesso.');
            void loadKeys();
          }}
        />
      )}
    </div>
  );
}
