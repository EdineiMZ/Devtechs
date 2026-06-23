'use client';

import {
  Button,
  Input,
  Modal,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@szdevs/ui';
import { useCallback, useEffect, useState } from 'react';

import type { AgrivorPriceAuditEntry, AgrivorPricePlan } from '@/lib/agrivor-api';

const MAX_QUOTA_CENTS = 1_000_000;

function fmtBRL(reais: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reais);
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

function centsToReais(cents: number): number {
  return cents / 100;
}

function reaisToCents(reais: number): number {
  return Math.round(reais * 100);
}

interface EditState {
  slug: string;
  amountReais: string;
  aiQuotaReais: string;
  saving: boolean;
  error: string | null;
}

interface AuditModal {
  slug: string;
  entries: AgrivorPriceAuditEntry[];
  loading: boolean;
}

export function PrecosTab(): JSX.Element {
  const [plans, setPlans] = useState<AgrivorPricePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [auditModal, setAuditModal] = useState<AuditModal | null>(null);

  const loadPlans = useCallback(async (): Promise<void> => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/admin/agrivor/m2m/prices');
      if (res.status === 503) {
        setFetchError('Serviço M2M indisponível.');
        return;
      }
      if (!res.ok) {
        setFetchError('Falha ao carregar planos.');
        return;
      }
      const data = (await res.json()) as AgrivorPricePlan[];
      setPlans(Array.isArray(data) ? data : []);
    } catch {
      setFetchError('Falha de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  function startEdit(plan: AgrivorPricePlan): void {
    setEditState({
      slug: plan.slug,
      amountReais: plan.priceReais.toFixed(2),
      aiQuotaReais: centsToReais(plan.aiQuotaCents).toFixed(2),
      saving: false,
      error: null,
    });
  }

  function cancelEdit(): void {
    setEditState(null);
  }

  async function saveEdit(): Promise<void> {
    if (!editState) return;

    const amountReais = parseFloat(editState.amountReais.replace(',', '.'));
    const aiQuotaReais = parseFloat(editState.aiQuotaReais.replace(',', '.'));

    if (isNaN(amountReais) || amountReais < 0) {
      setEditState((s) => (s ? { ...s, error: 'Preço inválido (mínimo R$ 0,00).' } : s));
      return;
    }
    if (isNaN(aiQuotaReais) || aiQuotaReais < 0) {
      setEditState((s) => (s ? { ...s, error: 'Quota de IA inválida (mínimo R$ 0,00).' } : s));
      return;
    }
    const aiQuotaCents = reaisToCents(aiQuotaReais);
    if (aiQuotaCents > MAX_QUOTA_CENTS) {
      setEditState((s) =>
        s
          ? {
              ...s,
              error: `Quota de IA não pode exceder ${fmtBRL(MAX_QUOTA_CENTS / 100)}.`,
            }
          : s,
      );
      return;
    }

    setEditState((s) => (s ? { ...s, saving: true, error: null } : s));
    try {
      const res = await fetch(
        `/api/admin/agrivor/m2m/prices/${encodeURIComponent(editState.slug)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amountCents: reaisToCents(amountReais), aiQuotaCents }),
        },
      );
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setEditState((s) =>
          s ? { ...s, saving: false, error: data.message ?? 'Falha ao salvar.' } : s,
        );
        return;
      }
      setEditState(null);
      void loadPlans();
    } catch {
      setEditState((s) => (s ? { ...s, saving: false, error: 'Falha de conexão.' } : s));
    }
  }

  async function openAudit(slug: string): Promise<void> {
    setAuditModal({ slug, entries: [], loading: true });
    try {
      const res = await fetch(
        `/api/admin/agrivor/m2m/prices/${encodeURIComponent(slug)}/audit`,
      );
      if (res.ok) {
        const data = (await res.json()) as AgrivorPriceAuditEntry[];
        setAuditModal({ slug, entries: Array.isArray(data) ? data : [], loading: false });
      } else {
        setAuditModal({ slug, entries: [], loading: false });
      }
    } catch {
      setAuditModal({ slug, entries: [], loading: false });
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" label="Carregando planos…" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
        ⚠ {fetchError}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/[0.02] py-12 text-center text-sm text-ash">
        Nenhum plano encontrado.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-white/8 bg-white/[0.02]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Slug</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Preço (R$)</TableHead>
              <TableHead>Quota de IA (R$)</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => {
              const isEditing = editState?.slug === plan.slug;
              return (
                <TableRow key={plan.slug}>
                  <TableCell className="font-mono text-xs text-ash">{plan.slug}</TableCell>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  {isEditing && editState ? (
                    <>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editState.amountReais}
                          onChange={(e) =>
                            setEditState((s) =>
                              s ? { ...s, amountReais: e.target.value } : s,
                            )
                          }
                          className="w-28"
                          aria-label="Preço em reais"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          max="10000"
                          value={editState.aiQuotaReais}
                          onChange={(e) =>
                            setEditState((s) =>
                              s ? { ...s, aiQuotaReais: e.target.value } : s,
                            )
                          }
                          className="w-28"
                          aria-label="Quota de IA em reais"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEdit}
                              disabled={editState.saving}
                            >
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => void saveEdit()}
                              disabled={editState.saving}
                            >
                              {editState.saving ? 'Salvando…' : 'Salvar'}
                            </Button>
                          </div>
                          {editState.error ? (
                            <p className="text-xs text-red-400">{editState.error}</p>
                          ) : null}
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-medium">{fmtBRL(plan.priceReais)}</TableCell>
                      <TableCell className="text-sm">
                        {fmtBRL(centsToReais(plan.aiQuotaCents))}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void openAudit(plan.slug)}
                          >
                            Histórico
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => startEdit(plan)}
                            disabled={editState !== null}
                          >
                            Editar
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {auditModal ? (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open) setAuditModal(null);
          }}
          title={`Histórico de preços — ${auditModal.slug}`}
        >
          {auditModal.loading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" label="Carregando histórico…" />
            </div>
          ) : auditModal.entries.length === 0 ? (
            <p className="py-4 text-center text-sm text-ash">Nenhuma alteração registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Campo</TableHead>
                  <TableHead>Anterior</TableHead>
                  <TableHead>Novo</TableHead>
                  <TableHead>Por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditModal.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {fmtDateTime(entry.changedAt)}
                    </TableCell>
                    <TableCell className="text-xs">{entry.field}</TableCell>
                    <TableCell className="text-xs">
                      {entry.oldValue !== null ? String(entry.oldValue) : '—'}
                    </TableCell>
                    <TableCell className="text-xs">{String(entry.newValue)}</TableCell>
                    <TableCell className="text-xs text-ash">
                      {entry.changedBy ?? 'sistema'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Modal>
      ) : null}
    </>
  );
}
