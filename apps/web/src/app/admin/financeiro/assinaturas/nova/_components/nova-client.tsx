'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { createRecurringSubscription } from '@/lib/recurring-billing-api';
import type { BillingProduct } from '@/lib/recurring-billing-api';
import type { UserAdminItem } from '@/lib/auth-admin-api';

interface ItemRow {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

interface Props {
  users: UserAdminItem[];
  products: BillingProduct[];
  accessToken: string;
}

export function NovaAssinaturaClient({ users, products, accessToken }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [billingDay, setBillingDay] = useState(1);
  const [billingDueDays, setBillingDueDays] = useState(5);
  const [nextBillingDate, setNextBillingDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0] ?? '';
  });
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemRow[]>([
    { productId: '', description: '', quantity: 1, unitPrice: 0 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function addItem() {
    setItems((prev) => [...prev, { productId: '', description: '', quantity: 1, unitPrice: 0 }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, patch: Partial<ItemRow>) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx]!, ...patch };
      if (patch.productId) {
        const product = products.find((p) => p.id === patch.productId);
        if (product) {
          next[idx]!.description = product.name;
          next[idx]!.unitPrice = product.unitPrice;
        }
      }
      return next;
    });
  }

  const monthlyTotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clientId) { setError('Selecione um cliente'); return; }
    if (!name.trim()) { setError('Informe o nome da assinatura'); return; }
    if (items.length === 0 || items.some((i) => !i.description.trim())) {
      setError('Todos os itens precisam de descrição');
      return;
    }
    setSaving(true);
    const res = await createRecurringSubscription(
      {
        clientId,
        name,
        description: description || undefined,
        billingDay,
        billingDueDays,
        nextBillingDate: nextBillingDate ?? '',
        notes: notes || undefined,
        items: items.map((i) => ({
          productId: i.productId || undefined,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      },
      accessToken,
    );
    setSaving(false);
    if (!res.ok) {
      setError((res.data as { message?: string }).message ?? 'Erro ao criar assinatura');
      return;
    }
    startTransition(() => router.push('/admin/financeiro/assinaturas'));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/financeiro/assinaturas"
          className="text-sm text-ash hover:text-foreground transition-colors"
        >
          ← Assinaturas
        </Link>
        <span className="text-ash/40">/</span>
        <h1 className="text-xl font-semibold text-foreground">Nova assinatura</h1>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {/* Basic info */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-6 space-y-4">
          <h2 className="text-xs font-semibold text-ash uppercase tracking-wide">
            Dados gerais
          </h2>

          <div>
            <label className="block text-sm font-medium text-ash mb-1">
              Cliente *
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Selecione um cliente...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name ?? u.email} — {u.email}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ash mb-1">
              Nome da assinatura *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: VPS Básica + Suporte"
              className="w-full rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ash mb-1">
              Descrição
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Billing schedule */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-6 space-y-4">
          <h2 className="text-xs font-semibold text-ash uppercase tracking-wide">
            Configuração de cobrança
          </h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-ash mb-1">
                Dia de cobrança *
              </label>
              <input
                type="number"
                min={1} max={28}
                value={billingDay}
                onChange={(e) => setBillingDay(Number(e.target.value))}
                className="w-full rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-ash">Dia do mês (1–28)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-ash mb-1">
                Dias para vencimento
              </label>
              <input
                type="number"
                min={1} max={30}
                value={billingDueDays}
                onChange={(e) => setBillingDueDays(Number(e.target.value))}
                className="w-full rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-ash">Após geração da fatura</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-ash mb-1">
                Primeira cobrança *
              </label>
              <input
                type="date"
                value={nextBillingDate}
                onChange={(e) => setNextBillingDate(e.target.value)}
                className="w-full rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ash mb-1">
              Observações internas
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Não visível para o cliente"
              className="w-full rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Line items */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-ash uppercase tracking-wide">
              Itens da cobrança
            </h2>
            <button
              type="button"
              onClick={addItem}
              className="text-xs text-primary hover:underline"
            >
              + Adicionar item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-4">
                  {idx === 0 && <label className="block text-xs font-medium text-ash mb-1">Produto (catálogo)</label>}
                  <select
                    value={item.productId}
                    onChange={(e) => updateItem(idx, { productId: e.target.value })}
                    className="w-full rounded-lg border border-white/8 bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">— Manual —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  {idx === 0 && <label className="block text-xs font-medium text-ash mb-1">Descrição *</label>}
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                    placeholder="Descrição"
                    className="w-full rounded-lg border border-white/8 bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <label className="block text-xs font-medium text-ash mb-1">Qtd</label>}
                  <input
                    type="number"
                    min={0.001}
                    step="any"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                    className="w-full rounded-lg border border-white/8 bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <label className="block text-xs font-medium text-ash mb-1">Preço unit.</label>}
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })}
                    className="w-full rounded-lg border border-white/8 bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="col-span-1 flex items-end justify-end pb-1">
                  {idx === 0 && <div className="h-5 mb-1" />}
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end border-t border-white/8 pt-3">
            <div className="text-right">
              <span className="text-sm text-ash mr-3">Total mensal:</span>
              <span className="text-lg font-bold text-foreground">{formatBRL(monthlyTotal)}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link
            href="/admin/financeiro/assinaturas"
            className="rounded-lg border border-white/8 px-4 py-2 text-sm font-medium text-ash hover:bg-white/[0.04]"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Criando...' : 'Criar assinatura'}
          </button>
        </div>
      </form>
    </div>
  );
}
