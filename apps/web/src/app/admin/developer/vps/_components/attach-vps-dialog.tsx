'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@szdevs/ui';

interface Client {
  id: string;
  name: string;
  email: string;
}

interface Project {
  id: string;
  name: string;
}

interface AttachVpsDialogProps {
  /**
   * Kept for API compatibility — the dialog used to inject this Bearer
   * token into a direct `fetch(http://developer-service:4010/vps)` call
   * from the browser, which leaked the credential and only worked from
   * inside the docker network. The submit now goes through the
   * server-side proxy at `/api/admin/vps`, which resolves the token
   * from the NextAuth session, so this prop is unused at the call site.
   */
  accessToken?: string;
  clients: Client[];
  projects: Project[];
}

export function AttachVpsDialog({ clients, projects }: AttachVpsDialogProps): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vmId, setVmId] = useState('');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [billingDayOfMonth, setBillingDayOfMonth] = useState('1');
  const [suspendAfterDays, setSuspendAfterDays] = useState('3');

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!vmId.trim() || !clientId) {
      setError('VM ID e cliente são obrigatórios.');
      return;
    }

    setLoading(true);
    setError(null);

    const body: Record<string, unknown> = {
      vmId: vmId.trim(),
      clientId,
    };
    if (projectId) body.projectId = projectId;
    if (label.trim()) body.label = label.trim();
    if (notes.trim()) body.notes = notes.trim();
    if (monthlyPrice) {
      body.monthlyPrice = parseFloat(monthlyPrice);
      body.billingDayOfMonth = parseInt(billingDayOfMonth, 10);
      body.suspendAfterDays = parseInt(suspendAfterDays, 10);
    }

    try {
      // Proxy through the Next.js API route — same origin, runs
      // server-side so it can reach developer-service on the internal
      // docker network (`http://developer-service:3010`) and attach the
      // Bearer token from the NextAuth session without exposing it to
      // the browser.
      const res = await fetch('/api/admin/vps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.message;
        setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao vincular VPS.'));
        return;
      }
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  }

  function resetForm(): void {
    setVmId('');
    setClientId('');
    setProjectId('');
    setLabel('');
    setNotes('');
    setMonthlyPrice('');
    setBillingDayOfMonth('1');
    setSuspendAfterDays('3');
    setError(null);
  }

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        + Vincular VPS
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-white/8 bg-white/[0.02] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <h2 className="text-lg font-bold tracking-tight text-foreground">Vincular VPS Hostinger</h2>
          <button
            type="button"
            onClick={() => { setOpen(false); resetForm(); }}
            className="text-ash hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="divide-y divide-border/60">
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-ash">VM ID Hostinger *</label>
              <input
                type="text"
                value={vmId}
                onChange={(e) => setVmId(e.target.value)}
                required
                placeholder="ex: 12345678"
                className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <p className="text-[11px] text-ash">
                ID retornado pela API da Hostinger para a VM já criada.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ash">Cliente *</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="">Selecione o cliente…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ash">Projeto (opcional)</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="">Nenhum projeto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ash">Label (opcional)</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="ex: VPS Produção Cliente X"
                maxLength={120}
                className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ash">Notas internas (opcional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações para o time"
                maxLength={2000}
                className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Billing */}
          <div className="p-6">
            <p className="mb-4 text-sm font-semibold text-foreground">Cobrança mensal automática</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ash">
                  Valor mensal (R$)
                </label>
                <input
                  type="number"
                  value={monthlyPrice}
                  onChange={(e) => setMonthlyPrice(e.target.value)}
                  min={0}
                  step={0.01}
                  placeholder="0,00 = desativado"
                  className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ash">
                  Dia do mês (1–28)
                </label>
                <input
                  type="number"
                  value={billingDayOfMonth}
                  onChange={(e) => setBillingDayOfMonth(e.target.value)}
                  min={1}
                  max={28}
                  disabled={!monthlyPrice}
                  className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ash">
                  Suspender após (dias)
                </label>
                <input
                  type="number"
                  value={suspendAfterDays}
                  onChange={(e) => setSuspendAfterDays(e.target.value)}
                  min={1}
                  max={30}
                  disabled={!monthlyPrice}
                  className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
                />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-ash">
              Deixe o valor mensal em branco para não gerar cobranças automáticas.
              Quando preenchido, o sistema gera uma fatura todo mês no dia configurado
              e suspende a VPS após o período de carência se não houver pagamento.
            </p>
          </div>

          {error ? (
            <div className="px-6 py-3 text-sm text-destructive">{error}</div>
          ) : null}

          <div className="flex justify-end gap-3 px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => { setOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Vinculando…' : 'Vincular VPS'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
