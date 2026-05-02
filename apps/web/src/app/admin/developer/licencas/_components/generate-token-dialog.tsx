'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@devtechs/ui';

import { fmtDate } from '@/lib/fmt-date';
import type { LicensedProduct } from '@/lib/license-api';

import { actionBindClient, actionGenerateToken, type GenerateTokenResult } from '../actions';

interface Client {
  id: string;
  name: string;
  email: string;
}

interface GenerateTokenDialogProps {
  products: LicensedProduct[];
  clients: Client[];
}

type Step = 'target' | 'options' | 'billing' | 'result';

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

export function GenerateTokenDialog({ products, clients }: GenerateTokenDialogProps): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('target');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — target
  const [productId, setProductId] = useState('');
  const [clientId, setClientId] = useState('');
  const [bindFirst, setBindFirst] = useState(false);

  // Step 2 — token options
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [hardwareId, setHardwareId] = useState('');

  // Step 3 — billing
  const [createBilling, setCreateBilling] = useState(false);
  const [billingType, setBillingType] = useState<'one_time' | 'subscription'>('one_time');
  const [price, setPrice] = useState('');
  const [dueDays, setDueDays] = useState('7');
  const [billingNotes, setBillingNotes] = useState('');

  // Step 4 — result
  const [result, setResult] = useState<GenerateTokenResult | null>(null);

  function reset(): void {
    setStep('target');
    setProductId('');
    setClientId('');
    setBindFirst(false);
    setMaxUses('');
    setExpiresAt('');
    setHardwareId('');
    setCreateBilling(false);
    setBillingType('one_time');
    setPrice('');
    setDueDays('7');
    setBillingNotes('');
    setResult(null);
    setError(null);
  }

  const selectedProduct = products.find((p) => p.id === productId);
  const selectedClient = clients.find((c) => c.id === clientId);

  async function handleBindAndNext(): Promise<void> {
    if (!productId || !clientId) {
      setError('Selecione produto e cliente.');
      return;
    }
    setError(null);
    if (bindFirst) {
      setLoading(true);
      const res = await actionBindClient(clientId, { productId });
      setLoading(false);
      if (!res.ok) {
        setError(res.message);
        return;
      }
    }
    setStep('options');
  }

  async function handleGenerate(): Promise<void> {
    setLoading(true);
    setError(null);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + parseInt(dueDays || '7', 10));

    const res = await actionGenerateToken({
      token: {
        clientId,
        productId,
        maxUses: maxUses ? parseInt(maxUses, 10) : undefined,
        expiresAt: expiresAt || undefined,
        hardwareId: hardwareId.trim() || undefined,
      },
      invoice:
        createBilling && price
          ? {
              clientId,
              items: [
                {
                  description:
                    billingType === 'subscription'
                      ? `Assinatura: ${selectedProduct?.name ?? 'Produto'} — ${selectedClient?.name ?? ''}`
                      : `Licença: ${selectedProduct?.name ?? 'Produto'} — ${selectedClient?.name ?? ''}`,
                  quantity: 1,
                  unitPrice: parseFloat(price),
                },
              ],
              dueDate: dueDate.toISOString().slice(0, 10),
              notes: billingNotes.trim() || undefined,
            }
          : undefined,
    });

    setLoading(false);
    setResult(res);
    setStep('result');
    if (res.ok) router.refresh();
  }

  function close(): void {
    setOpen(false);
    reset();
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        + Gerar key de ativação
      </Button>
    );
  }

  const stepLabels: Record<Step, string> = {
    target: '1. Produto & Cliente',
    options: '2. Configurações',
    billing: '3. Cobrança',
    result: '4. Resultado',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-lg flex-col rounded-2xl border border-white/8 bg-white/[0.02] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground">
              Gerar key de ativação
            </h2>
            <p className="mt-0.5 text-xs text-ash">{stepLabels[step]}</p>
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
          {(['target', 'options', 'billing', 'result'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  s === step
                    ? 'bg-sky-500 text-white'
                    : step === 'result' || ['target', 'options', 'billing'].indexOf(s) < ['target', 'options', 'billing'].indexOf(step)
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'bg-white/5 text-ash'
                }`}
              >
                {i + 1}
              </span>
              {i < 3 && <div className="mx-1 h-px w-6 bg-border/40" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* ── Step 1: Target ─────────────────────────────────────────── */}
          {step === 'target' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ash">Produto *</label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  required
                  className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">Selecione o produto…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.appId})
                    </option>
                  ))}
                </select>
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
                      {c.name} — {c.email}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <input
                  type="checkbox"
                  checked={bindFirst}
                  onChange={(e) => setBindFirst(e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Vincular cliente ao produto</p>
                  <p className="text-xs text-ash">
                    Marque se o cliente ainda não foi vinculado a este produto. Caso já esteja
                    vinculado, deixe desmarcado.
                  </p>
                </div>
              </label>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={close}>Cancelar</Button>
                <Button
                  type="button"
                  disabled={!productId || !clientId || loading}
                  onClick={() => { void handleBindAndNext(); }}
                >
                  {loading ? 'Vinculando…' : 'Próximo'}
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 2: Token options ──────────────────────────────────── */}
          {step === 'options' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-xs text-ash">
                <span className="font-medium text-foreground">{selectedProduct?.name}</span>
                {' → '}
                <span className="font-medium text-foreground">{selectedClient?.name}</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ash">
                    Máx. de ativações
                  </label>
                  <input
                    type="number"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    min={1}
                    placeholder="Ilimitado"
                    className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  <p className="text-[11px] text-ash">Deixe em branco para ilimitado.</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ash">
                    Validade (data)
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
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ash">
                  Hardware ID (opcional)
                </label>
                <input
                  type="text"
                  value={hardwareId}
                  onChange={(e) => setHardwareId(e.target.value)}
                  placeholder="ex: AA:BB:CC:DD:EE:FF"
                  maxLength={120}
                  className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <p className="text-[11px] text-ash">
                  Vincula o token a um hardware específico. Sem Hardware ID a vinculação ocorre
                  na primeira ativação.
                </p>
              </div>

              <div className="flex justify-between gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setStep('target')}>
                  Voltar
                </Button>
                <Button type="button" onClick={() => setStep('billing')}>
                  Próximo
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Billing ────────────────────────────────────────── */}
          {step === 'billing' && (
            <div className="flex flex-col gap-4">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <input
                  type="checkbox"
                  checked={createBilling}
                  onChange={(e) => setCreateBilling(e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Gerar cobrança ao emitir a key</p>
                  <p className="text-xs text-ash">
                    Cria automaticamente uma fatura no módulo Financeiro vinculada a este cliente.
                  </p>
                </div>
              </label>

              {createBilling && (
                <div className="flex flex-col gap-4 rounded-xl border border-white/8 p-4">
                  <div className="flex gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="billingType"
                        value="one_time"
                        checked={billingType === 'one_time'}
                        onChange={() => setBillingType('one_time')}
                      />
                      <span className="font-medium text-foreground">Avulso</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="billingType"
                        value="subscription"
                        checked={billingType === 'subscription'}
                        onChange={() => setBillingType('subscription')}
                      />
                      <span className="font-medium text-foreground">Assinatura / Recorrente</span>
                    </label>
                  </div>

                  {billingType === 'subscription' && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-400">
                      <strong>Assinatura:</strong> A fatura inicial será criada agora. Ao revogar a
                      key você terá a opção de cancelar a fatura associada. Renovações futuras devem
                      ser geradas manualmente ou via automação de cobranças recorrentes.
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-ash">
                        Valor (R$) *
                      </label>
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        min={0.01}
                        step={0.01}
                        required={createBilling}
                        placeholder="0,00"
                        className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-ash">
                        Vencimento (dias)
                      </label>
                      <input
                        type="number"
                        value={dueDays}
                        onChange={(e) => setDueDays(e.target.value)}
                        min={1}
                        max={365}
                        className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                      <p className="text-[11px] text-ash">Dias a partir de hoje.</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-ash">
                      Observações da fatura (opcional)
                    </label>
                    <textarea
                      value={billingNotes}
                      onChange={(e) => setBillingNotes(e.target.value)}
                      rows={2}
                      maxLength={500}
                      placeholder="Informações adicionais para o cliente"
                      className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-between gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setStep('options')}>
                  Voltar
                </Button>
                <Button
                  type="button"
                  disabled={loading || (createBilling && !price)}
                  onClick={() => { void handleGenerate(); }}
                >
                  {loading ? 'Gerando…' : 'Gerar key'}
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 4: Result ────────────────────────────────────────── */}
          {step === 'result' && result && (
            <div className="flex flex-col gap-4">
              {result.ok ? (
                <>
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                    <span className="text-lg">✓</span> Key gerada com sucesso
                  </div>

                  <div className="flex flex-col gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-4">
                    <div>
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ash">
                        Chave de ativação
                      </p>
                      <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-background px-3 py-2">
                        <code className="flex-1 break-all font-mono text-xs text-foreground">
                          {result.key}
                        </code>
                        <CopyButton value={result.key ?? ''} />
                      </div>
                    </div>

                    <div>
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ash">
                        Hash SHA-256
                      </p>
                      <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-background px-3 py-2">
                        <code className="flex-1 break-all font-mono text-xs text-ash">
                          {result.hash}
                        </code>
                        <CopyButton value={result.hash ?? ''} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-ash">Validade:</span>{' '}
                        <span className="text-foreground">
                          {result.expiresAt
                            ? fmtDate(result.expiresAt)
                            : 'Sem expiração'}
                        </span>
                      </div>
                      <div>
                        <span className="text-ash">Máx. ativações:</span>{' '}
                        <span className="text-foreground">
                          {result.maxUses ?? 'Ilimitado'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {result.invoiceId && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
                      <p className="font-semibold text-emerald-400">Fatura criada</p>
                      <p className="mt-1 text-ash">
                        ID:{' '}
                        <code className="font-mono text-xs text-foreground">{result.invoiceId}</code>
                      </p>
                      <p className="mt-1 text-xs text-ash">
                        Acesse o módulo Financeiro para visualizar e enviar a cobrança ao cliente.
                      </p>
                    </div>
                  )}

                  {result.invoiceError && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-400">
                      <strong>Aviso:</strong> Key gerada, mas houve um erro ao criar a fatura:{' '}
                      {result.invoiceError}
                    </div>
                  )}

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
                    <strong>⚠ Guarde a chave agora.</strong> Por segurança, a chave completa não
                    ficará disponível após fechar este painel. O hash pode ser usado para
                    verificação offline.
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                  <p className="font-semibold">Erro ao gerar token</p>
                  <p className="mt-1">{result.message}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                {result.ok ? (
                  <>
                    <Button type="button" variant="ghost" onClick={reset}>
                      Gerar outro
                    </Button>
                    <Button type="button" onClick={close}>
                      Fechar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="ghost" onClick={() => setStep('billing')}>
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
