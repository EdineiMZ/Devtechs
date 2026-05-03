'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@szdevs/ui';

import type { LicensedProduct } from '@/lib/license-api';

import { actionUpdateProduct } from '../actions';

interface EditProductDialogProps {
  product: LicensedProduct;
}

export function EditProductDialog({ product }: EditProductDialogProps): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? '');

  function handleOpen(): void {
    setName(product.name);
    setDescription(product.description ?? '');
    setError(null);
    setOpen(true);
  }

  function handleClose(): void {
    setOpen(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nome é obrigatório.');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await actionUpdateProduct(product.id, {
      name: name.trim(),
      description: description.trim() || undefined,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="rounded px-2 py-1 text-xs font-medium text-ash hover:bg-white/5 hover:text-foreground"
        title="Editar produto"
      >
        Editar
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/8 bg-white/[0.02] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground">Editar produto</h2>
            <p className="mt-0.5 text-xs text-ash">
              App ID: <code className="font-mono">{product.appId}</code>
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-ash hover:text-foreground"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => { void handleSubmit(e); }}
          className="flex flex-col gap-4 p-6"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ash">
              Nome do produto *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              placeholder="ex: SZDevs ERP"
              className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ash">
              Descrição (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Descreva o produto brevemente"
              className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-xs text-ash">
            O <strong>App ID</strong> (<code className="font-mono">{product.appId}</code>) não pode ser
            alterado — ele é o identificador usado pelo software para verificar as keys.
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
