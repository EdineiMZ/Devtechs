'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  createBillingProduct,
  updateBillingProduct,
  deactivateBillingProduct,
} from '@/lib/recurring-billing-api';
import type { BillingProduct } from '@/lib/recurring-billing-api';

interface Props {
  products: BillingProduct[];
  accessToken: string;
  canManage: boolean;
}

type FormState = Omit<BillingProduct, 'id' | 'createdAt' | 'updatedAt'>;

const EMPTY_FORM: FormState = {
  name: '',
  description: null,
  unitPrice: 0,
  unit: 'mês',
  category: null,
  isActive: true,
  isLicensed: false,
};

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export function ProductsClient({ products, accessToken, canManage }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean)),
  ) as string[];

  const filtered = categoryFilter === 'ALL'
    ? products
    : products.filter((p) => p.category === categoryFilter);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(product: BillingProduct) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description,
      unitPrice: product.unitPrice,
      unit: product.unit,
      category: product.category,
      isActive: product.isActive,
      isLicensed: product.isLicensed,
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSave() {
    setError(null);
    if (!form.name.trim()) { setError('Informe o nome do produto'); return; }
    if (form.unitPrice < 0) { setError('Preço não pode ser negativo'); return; }

    const body = {
      ...form,
      description: form.description || null,
      category: form.category || null,
    };

    const res = editingId
      ? await updateBillingProduct(editingId, body, accessToken)
      : await createBillingProduct(body, accessToken);

    if (!res.ok) {
      setError((res.data as { message?: string }).message ?? 'Erro ao salvar produto');
      return;
    }
    setShowForm(false);
    startTransition(() => router.refresh());
  }

  async function handleDeactivate(id: string) {
    if (!confirm('Desativar este produto? Ele não aparecerá mais nas assinaturas novas.')) return;
    const res = await deactivateBillingProduct(id, accessToken);
    if (!res.ok) {
      alert((res.data as { message?: string }).message ?? 'Erro ao desativar');
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Catálogo de Produtos
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Produtos e serviços pré-definidos para cobranças recorrentes
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Novo produto
          </button>
        )}
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {(['ALL', ...categories] as string[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                categoryFilter === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {cat === 'ALL' ? 'Todos' : cat}
            </button>
          ))}
        </div>
      )}

      {/* Products grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center text-sm text-gray-500 dark:text-gray-400">
          Nenhum produto cadastrado ainda.
          {canManage && (
            <div className="mt-3">
              <button onClick={openCreate} className="text-blue-600 dark:text-blue-400 hover:underline">
                Cadastrar primeiro produto
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <div
              key={product.id}
              className={`rounded-xl border bg-white dark:bg-gray-800 p-5 transition-all ${
                product.isActive
                  ? 'border-gray-200 dark:border-gray-700'
                  : 'border-gray-100 dark:border-gray-800 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {product.name}
                  </h3>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {product.category && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded px-2 py-0.5">
                        {product.category}
                      </span>
                    )}
                    {product.isLicensed && (
                      <span className="text-xs text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 rounded px-2 py-0.5">
                        Licenciado
                      </span>
                    )}
                  </div>
                </div>
                {!product.isActive && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">Inativo</span>
                )}
              </div>

              {product.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                  {product.description}
                </p>
              )}

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatBRL(product.unitPrice)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">por {product.unit}</p>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(product)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Editar
                    </button>
                    {product.isActive && (
                      <button
                        onClick={() => void handleDeactivate(product.id)}
                        disabled={isPending}
                        className="text-xs text-red-500 dark:text-red-400 hover:underline"
                      >
                        Desativar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingId ? 'Editar produto' : 'Novo produto'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: VPS Básica 2vCPU"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={form.description ?? ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value || null })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preço (R$) *</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.unitPrice}
                    onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unidade</label>
                  <input
                    type="text"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="mês, ano, hora, GB"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria</label>
                <input
                  type="text"
                  value={form.category ?? ''}
                  onChange={(e) => setForm({ ...form, category: e.target.value || null })}
                  placeholder="Ex: VPS, Hospedagem, Suporte..."
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isLicensed}
                  onChange={(e) => setForm({ ...form, isLicensed: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Produto licenciado{' '}
                  <span className="text-xs text-gray-500">(aparece em Developer → Licenças)</span>
                </span>
              </label>

              {editingId && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Produto ativo</span>
                </label>
              )}
            </div>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setShowForm(false); setError(null); }}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
