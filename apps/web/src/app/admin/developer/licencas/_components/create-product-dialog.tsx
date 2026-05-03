'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@szdevs/ui';

import { actionCreateProduct } from '../actions';

export function CreateProductDialog(): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [appId, setAppId] = useState('');
  const [description, setDescription] = useState('');

  function reset(): void {
    setName('');
    setAppId('');
    setDescription('');
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim() || !appId.trim()) {
      setError('Nome e App ID são obrigatórios.');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await actionCreateProduct({
      name: name.trim(),
      appId: appId.trim().toLowerCase().replace(/\s+/g, '-'),
      description: description.trim() || undefined,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOpen(false);
    reset();
    router.refresh();
  }

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        + Novo produto
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/8 bg-white/[0.02] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <h2 className="text-base font-bold tracking-tight text-foreground">Novo produto licenciado</h2>
          <button
            type="button"
            onClick={() => { setOpen(false); reset(); }}
            className="text-ash hover:text-foreground"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ash">Nome do produto *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="ex: SZDevs ERP"
              maxLength={120}
              className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ash">App ID *</label>
            <input
              type="text"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              required
              placeholder="ex: SZDevs-erp"
              maxLength={80}
              pattern="[a-zA-Z0-9\-_]+"
              className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <p className="text-[11px] text-ash">
              Identificador único do app que verifica as keys (letras, números e hífens).
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ash">Descrição (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Descreva o produto brevemente"
              className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => { setOpen(false); reset(); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando…' : 'Criar produto'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
