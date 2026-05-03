'use client';

import { useState } from 'react';
import { Button } from '@szdevs/ui';
import { createInvoice } from '@/lib/finance-api';

interface Project {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
}

interface NewInvoiceDialogProps {
  accessToken: string;
  projects: Project[];
  clients: Client[];
  onCreated: () => void;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export function NewInvoiceDialog({
  accessToken,
  projects,
  clients,
  onCreated,
}: NewInvoiceDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unitPrice: 0 },
  ]);

  function addItem(): void {
    setItems((prev) => [...prev, { description: '', quantity: 1, unitPrice: 0 }]);
  }

  function removeItem(index: number): void {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem<K extends keyof InvoiceItem>(
    index: number,
    key: K,
    value: InvoiceItem[K],
  ): void {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  }

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!clientId || !dueDate || items.some((i) => !i.description)) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await createInvoice(
      {
        clientId,
        projectId: projectId || undefined,
        items,
        dueDate,
        notes: notes || undefined,
      },
      accessToken,
    );

    setLoading(false);

    if (!res.ok) {
      const errData = res.data as { message?: string | string[] };
      const msg = Array.isArray(errData.message)
        ? errData.message.join(', ')
        : (errData.message ?? 'Erro ao criar fatura.');
      setError(msg);
      return;
    }

    // Reset form
    setClientId('');
    setProjectId('');
    setDueDate('');
    setNotes('');
    setItems([{ description: '', quantity: 1, unitPrice: 0 }]);
    setOpen(false);
    onCreated();
  }

  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        type="button"
        size="sm"
      >
        + Nova Fatura
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/8 bg-white/[0.02] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <h2 className="text-lg font-bold tracking-tight text-foreground">Nova Fatura</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-ash hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="divide-y divide-border/60">
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            {/* Client */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ash">
                Cliente *
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="">Selecione o cliente…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? c.email} ({c.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Project */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ash">
                Projeto (opcional)
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="">Nenhum projeto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Due date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ash">
                Vencimento *
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ash">
                Observações
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas internas…"
                className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Items */}
          <div className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Itens</p>
              <button
                type="button"
                onClick={addItem}
                className="text-xs text-sky-400 hover:underline"
              >
                + Adicionar item
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(i, 'description', e.target.value)}
                    placeholder="Descrição *"
                    required
                    className="flex-1 rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))}
                    min={0.001}
                    step={0.001}
                    className="w-20 rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  <input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))}
                    min={0}
                    step={0.01}
                    placeholder="R$"
                    className="w-28 rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="py-2 text-ash hover:text-destructive"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <p className="text-sm font-semibold text-foreground">
                Total: {fmt.format(subtotal)}
              </p>
            </div>
          </div>

          {error && (
            <div className="px-6 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando…' : 'Criar Fatura'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
