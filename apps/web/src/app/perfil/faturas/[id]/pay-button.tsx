'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';

import { checkoutInvoice, type PixPaymentResponse } from '@/lib/finance-api';

/* ---------- MP types ---------- */
declare global {
  interface Window {
    MercadoPago: new (
      publicKey: string,
      options?: { locale: string },
    ) => MpInstance;
  }
}
interface MpInstance {
  createCardToken(params: {
    cardNumber: string;
    cardholderName: string;
    cardExpirationMonth: string;
    cardExpirationYear: string;
    securityCode: string;
    identificationType: string;
    identificationNumber: string;
  }): Promise<{ id: string; status: string; cause?: Array<{ code: string; description: string }> }>;
}

/* ---------- Helpers ---------- */
function detectBrand(number: string): 'visa' | 'master' | 'amex' | 'elo' {
  const n = number.replace(/\s/g, '');
  if (/^4/.test(n)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'master';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^6/.test(n)) return 'elo';
  return 'master';
}

function mpStatusDetailToMessage(detail: string | null | undefined): string {
  switch (detail) {
    case 'cc_rejected_bad_filled_card_number':
      return 'Número do cartão inválido. Verifique e tente novamente.';
    case 'cc_rejected_bad_filled_date':
      return 'Data de validade inválida.';
    case 'cc_rejected_bad_filled_security_code':
      return 'CVV inválido.';
    case 'cc_rejected_bad_filled_other':
      return 'Dados do cartão incorretos. Confira e tente novamente.';
    case 'cc_rejected_blacklist':
      return 'Cartão bloqueado. Entre em contato com sua operadora.';
    case 'cc_rejected_call_for_authorize':
      return 'Pagamento não autorizado. Contate sua operadora para liberar a transação.';
    case 'cc_rejected_card_disabled':
      return 'Cartão inativo. Ative-o pelo app do banco ou contate a operadora.';
    case 'cc_rejected_card_error':
      return 'Não foi possível processar seu cartão. Tente novamente ou use outro cartão.';
    case 'cc_rejected_duplicated_payment':
      return 'Pagamento duplicado. Já existe uma transação igual registrada.';
    case 'cc_rejected_high_risk':
      return 'Pagamento recusado por análise de risco. Tente outro cartão.';
    case 'cc_rejected_insufficient_amount':
      return 'Saldo insuficiente no cartão.';
    case 'cc_rejected_invalid_installments':
      return 'Número de parcelas não suportado por este cartão.';
    case 'cc_rejected_max_attempts':
      return 'Limite de tentativas atingido. Aguarde ou use outro cartão.';
    case 'pending_contingency':
    case 'pending_review_manual':
      return 'Pagamento em análise. Você receberá uma notificação em breve.';
    default:
      return 'Pagamento recusado pela operadora. Tente novamente ou use outro método.';
  }
}

function maskCardNumber(raw: string): string {
  const clean = raw.replace(/\D/g, '').slice(0, 16);
  const padded = clean.padEnd(16, '•');
  return `${padded.slice(0, 4)} ${padded.slice(4, 8)} ${padded.slice(8, 12)} ${padded.slice(12)}`;
}

/* ---------- Constants ---------- */
const MP_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? 'TEST-c6c55ecf-5f34-4034-b6e3-faac53bc9b95';
const IS_SANDBOX = MP_PUBLIC_KEY.startsWith('TEST-');

/* ---------- Brand icon ---------- */
function CardBrandIcon({ brand }: { brand: string }): JSX.Element {
  if (brand === 'visa') {
    return (
      <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-black tracking-tight text-blue-700">
        VISA
      </span>
    );
  }
  if (brand === 'master') {
    return (
      <span className="flex items-center gap-0.5">
        <span className="h-4 w-4 rounded-full bg-red-500 opacity-90" />
        <span className="-ml-2 h-4 w-4 rounded-full bg-amber-400 opacity-90" />
      </span>
    );
  }
  if (brand === 'amex') {
    return (
      <span className="rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
        AMEX
      </span>
    );
  }
  if (brand === 'elo') {
    return (
      <span className="rounded bg-yellow-400 px-1.5 py-0.5 text-[10px] font-black text-black">
        elo
      </span>
    );
  }
  return <span className="text-[10px] text-white/40">••••</span>;
}

/* ---------- Card Preview ---------- */
function CardPreview({
  number,
  name,
  month,
  year,
}: {
  number: string;
  name: string;
  month: string;
  year: string;
}): JSX.Element {
  const brand = detectBrand(number);
  const displayNum = maskCardNumber(number);
  const displayName = name.trim() || 'SEU NOME';
  const displayExp =
    month && year ? `${month.padStart(2, '0')}/${year.slice(-2)}` : 'MM/AA';

  return (
    <div
      className="relative mx-auto h-44 w-72 overflow-hidden rounded-2xl"
      style={{
        background: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 50%, #7c3aed 100%)',
        boxShadow: '0 20px 60px rgba(109,40,217,0.35)',
      }}
    >
      {/* Decorative circles */}
      <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/5" />
      <div className="absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-white/5" />

      {/* Chip */}
      <div className="absolute left-6 top-7 h-8 w-11 overflow-hidden rounded-md bg-amber-300/80">
        <div className="absolute inset-0 grid grid-cols-2 gap-px p-0.5 opacity-60">
          <div className="rounded-sm bg-amber-500/80" />
          <div className="rounded-sm bg-amber-500/80" />
          <div className="rounded-sm bg-amber-500/80" />
          <div className="rounded-sm bg-amber-500/80" />
        </div>
      </div>

      {/* Brand */}
      <div className="absolute right-5 top-5">
        <CardBrandIcon brand={brand} />
      </div>

      {/* Number */}
      <div className="absolute bottom-14 left-0 right-0 px-6">
        <p className="font-mono text-lg tracking-[0.25em] text-white/90">
          {displayNum}
        </p>
      </div>

      {/* Name + Expiry */}
      <div className="absolute bottom-5 left-0 right-0 flex items-end justify-between px-6">
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-widest text-white/50">
            Titular
          </p>
          <p className="truncate text-xs font-semibold tracking-wider text-white">
            {displayName}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-widest text-white/50">
            Validade
          </p>
          <p className="text-xs font-semibold tracking-wider text-white">
            {displayExp}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Step indicator ---------- */
type Step =
  | 'choose'
  | 'card'
  | 'pix-loading'
  | 'pix-qr'
  | 'card-loading'
  | 'success'
  | 'error';

const STEPS_MAP: Record<Step, number> = {
  choose: 0,
  card: 1,
  'pix-loading': 1,
  'pix-qr': 2,
  'card-loading': 2,
  success: 3,
  error: 3,
};

function StepDots({ current }: { current: Step }): JSX.Element {
  const active = STEPS_MAP[current];
  return (
    <div className="flex items-center justify-center gap-2">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i <= active
              ? 'w-6 bg-violet-500'
              : 'w-1.5 bg-white/20'
          }`}
        />
      ))}
    </div>
  );
}

/* ---------- Main component ---------- */
export function PayButton({
  invoiceId,
  accessToken,
  invoiceAmount,
  invoiceNumber,
}: {
  invoiceId: string;
  accessToken: string;
  invoiceAmount?: number;
  invoiceNumber?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('choose');
  const [pix, setPix] = useState<PixPaymentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const mpRef = useRef<MpInstance | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  /* card form state */
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardMonth, setCardMonth] = useState('');
  const [cardYear, setCardYear] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardCpf, setCardCpf] = useState('');
  const [installments, setInstallments] = useState('1');

  /* Initialise MP SDK */
  function handleMpLoad(): void {
    if (typeof window !== 'undefined' && window.MercadoPago && !mpRef.current) {
      mpRef.current = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
    }
  }

  useEffect(() => {
    handleMpLoad();
  });

  /* Close modal with Escape */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'card-loading' && step !== 'pix-loading') {
        setOpen(false);
      }
    },
    [step],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  function openModal(): void {
    setStep('choose');
    setError(null);
    setPix(null);
    setOpen(true);
  }

  function closeModal(): void {
    if (step === 'card-loading' || step === 'pix-loading') return;
    setOpen(false);
    setTimeout(() => {
      setStep('choose');
      setError(null);
    }, 300);
  }

  /* ---- PIX ---- */
  async function payPix(): Promise<void> {
    setStep('pix-loading');
    setError(null);
    const res = await checkoutInvoice(invoiceId, { method: 'pix' }, accessToken);
    if (!res.ok) {
      const data = res.data as { message?: string | string[] };
      const msg = Array.isArray(data?.message)
        ? data.message.join(', ')
        : (data?.message ?? 'Falha ao gerar PIX.');
      setError(msg);
      setStep('error');
      return;
    }
    setPix(res.data as PixPaymentResponse);
    setStep('pix-qr');
  }

  async function copyCode(): Promise<void> {
    if (!pix?.pixQrCode) return;
    await navigator.clipboard.writeText(pix.pixQrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  /* ---- Card ---- */
  async function payCard(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!mpRef.current) {
      setError('SDK do Mercado Pago ainda não carregou. Aguarde um instante e tente novamente.');
      setStep('error');
      return;
    }

    setStep('card-loading');
    setError(null);

    let token: string;
    try {
      const result = await mpRef.current.createCardToken({
        cardNumber: cardNumber.replace(/\s/g, ''),
        cardholderName: cardName,
        cardExpirationMonth: cardMonth.padStart(2, '0'),
        cardExpirationYear: cardYear.length === 2 ? `20${cardYear}` : cardYear,
        securityCode: cardCvv,
        identificationType: 'CPF',
        identificationNumber: cardCpf.replace(/\D/g, ''),
      });
      if (!result?.id) {
        const causes = result?.cause?.map((c) => c.description).join(', ') ?? '';
        setError(`Não foi possível validar os dados do cartão.${causes ? ` ${causes}` : ''}`);
        setStep('error');
        return;
      }
      token = result.id;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Não foi possível validar os dados do cartão.';
      setError(msg);
      setStep('error');
      return;
    }

    const res = await checkoutInvoice(
      invoiceId,
      {
        method: 'card',
        card: {
          token,
          installments,
          paymentMethodId: detectBrand(cardNumber),
        },
      },
      accessToken,
    );

    if (!res.ok) {
      const data = res.data as { message?: string | string[]; statusDetail?: string };
      const detail = data?.statusDetail;
      const fallback = Array.isArray(data?.message)
        ? data.message.join(', ')
        : (data?.message ?? null);
      setError(mpStatusDetailToMessage(detail) ?? fallback ?? 'Pagamento recusado.');
      setStep('error');
      return;
    }

    const data = res.data as { status?: string; statusDetail?: string };
    const mpStatus = data?.status;

    if (mpStatus && mpStatus !== 'approved') {
      const detail = data?.statusDetail;
      setError(
        mpStatus === 'rejected'
          ? mpStatusDetailToMessage(detail)
          : `Pagamento com status "${mpStatus}". Aguarde a confirmação ou contate o suporte.`,
      );
      setStep('error');
      return;
    }

    setStep('success');
    setTimeout(() => window.location.reload(), 2500);
  }

  /* ---- Trigger button ---- */
  return (
    <>
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="lazyOnload"
        onLoad={handleMpLoad}
      />

      {/* Trigger */}
      <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 to-purple-500/5 p-5">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {invoiceNumber ? `Fatura ${invoiceNumber} em aberto` : 'Fatura em aberto'}
          </p>
          <p className="mt-0.5 text-xs text-ash">
            {invoiceAmount !== undefined
              ? `${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoiceAmount)} · `
              : ''}
            Escolha PIX ou cartão de crédito para pagar com segurança.
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="shrink-0 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-500 hover:shadow-violet-500/50 active:scale-95"
        >
          Pagar agora
        </button>
      </div>

      {/* Modal overlay */}
      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={(e) => {
            if (e.target === overlayRef.current) closeModal();
          }}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d0f] shadow-2xl"
            style={{ boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600/20">
                  <svg viewBox="0 0 20 20" className="h-4 w-4 fill-violet-400" aria-hidden="true">
                    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                    <path
                      fillRule="evenodd"
                      d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-white">
                  Pagamento seguro
                </span>
              </div>
              {step !== 'card-loading' && step !== 'pix-loading' && (
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Fechar"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white"
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3l10 10M13 3L3 13" />
                  </svg>
                </button>
              )}
            </div>

            {/* Step dots */}
            <div className="border-b border-white/10 px-6 py-3">
              <StepDots current={step} />
            </div>

            {/* Content */}
            <div className="p-6">
              {/* ---- Choose ---- */}
              {step === 'choose' && (
                <div className="space-y-3">
                  <p className="text-center text-xs text-white/40">
                    Selecione a forma de pagamento
                  </p>

                  {/* PIX */}
                  <button
                    type="button"
                    onClick={() => void payPix()}
                    className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left transition hover:border-emerald-500/40 hover:bg-emerald-500/5 active:scale-[0.98]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                        <path
                          d="M7 3L17 3M12 3V21M17 21L7 21"
                          stroke="#34d399"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M4.5 8.5L8.5 4.5M8.5 4.5L12.5 8.5M8.5 4.5V14.5"
                          stroke="#34d399"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M19.5 15.5L15.5 19.5M15.5 19.5L11.5 15.5M15.5 19.5V9.5"
                          stroke="#34d399"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">PIX</p>
                      <p className="text-xs text-white/40">
                        QR Code instantâneo · aprovação imediata
                      </p>
                    </div>
                    <div className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                      Rápido
                    </div>
                  </button>

                  {/* Card */}
                  <button
                    type="button"
                    onClick={() => setStep('card')}
                    className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left transition hover:border-violet-500/40 hover:bg-violet-500/5 active:scale-[0.98]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-violet-400" aria-hidden="true">
                        <path d="M4 4a2 2 0 00-2 2v1h20V6a2 2 0 00-2-2H4z" />
                        <path
                          fillRule="evenodd"
                          d="M22 10H2v8a2 2 0 002 2h16a2 2 0 002-2v-8zM5 14a1 1 0 011-1h1a1 1 0 110 2H6a1 1 0 01-1-1zm4-1a1 1 0 100 2h2a1 1 0 100-2H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">Cartão de crédito</p>
                      <p className="text-xs text-white/40">
                        Visa, Mastercard, Elo e outros
                      </p>
                    </div>
                    <svg viewBox="0 0 16 16" className="h-4 w-4 text-white/30" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 4l4 4-4 4" />
                    </svg>
                  </button>

                  {/* Security note */}
                  <p className="text-center text-[10px] text-white/20">
                    🔒 Pagamento processado com criptografia SSL via Mercado Pago
                  </p>
                </div>
              )}

              {/* ---- Card form ---- */}
              {step === 'card' && (
                <div>
                  <CardPreview
                    number={cardNumber}
                    name={cardName}
                    month={cardMonth}
                    year={cardYear}
                  />

                  <form onSubmit={(e) => void payCard(e)} className="mt-5 space-y-3">
                    {/* Card number */}
                    <div>
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/40">
                        Número do cartão
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        maxLength={19}
                        value={cardNumber}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 16);
                          setCardNumber(v.replace(/(.{4})/g, '$1 ').trim());
                        }}
                        placeholder="0000 0000 0000 0000"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white placeholder:text-white/20 focus:border-violet-500/60 focus:bg-violet-500/5 focus:outline-none"
                      />
                    </div>

                    {/* Cardholder name */}
                    <div>
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/40">
                        Nome no cartão
                      </label>
                      <input
                        type="text"
                        required
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value.toUpperCase())}
                        placeholder="NOME COMPLETO"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm uppercase text-white placeholder:text-white/20 focus:border-violet-500/60 focus:bg-violet-500/5 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {/* Expiry */}
                      <div className="col-span-1">
                        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/40">
                          Validade
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          maxLength={5}
                          value={cardMonth && cardYear ? `${cardMonth}/${cardYear}` : cardMonth}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '');
                            setCardMonth(raw.slice(0, 2));
                            setCardYear(raw.slice(2, 4));
                          }}
                          placeholder="MM/AA"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center font-mono text-sm text-white placeholder:text-white/20 focus:border-violet-500/60 focus:bg-violet-500/5 focus:outline-none"
                        />
                      </div>

                      {/* CVV */}
                      <div className="col-span-1">
                        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/40">
                          CVV
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          maxLength={4}
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                          placeholder="•••"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center font-mono text-sm text-white placeholder:text-white/20 focus:border-violet-500/60 focus:bg-violet-500/5 focus:outline-none"
                        />
                      </div>

                      {/* Installments */}
                      <div className="col-span-1">
                        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/40">
                          Parcelas
                        </label>
                        <select
                          value={installments}
                          onChange={(e) => setInstallments(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-[#0d0d0f] px-2 py-3 text-sm text-white focus:border-violet-500/60 focus:outline-none"
                        >
                          {[1, 2, 3, 6, 12].map((n) => (
                            <option key={n} value={String(n)}>
                              {n}×
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* CPF */}
                    <div>
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/40">
                        CPF do titular
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        maxLength={14}
                        value={cardCpf}
                        onChange={(e) => {
                          const n = e.target.value.replace(/\D/g, '').slice(0, 11);
                          setCardCpf(
                            n
                              .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
                              .replace(/(\d{3})(\d{3})(\d{1,3})$/, '$1.$2.$3'),
                          );
                        }}
                        placeholder="000.000.000-00"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white placeholder:text-white/20 focus:border-violet-500/60 focus:bg-violet-500/5 focus:outline-none"
                      />
                    </div>

                    {/* Sandbox hint */}
                    {IS_SANDBOX && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                        <p className="text-[10px] font-semibold text-amber-400">
                          🧪 Ambiente de testes
                        </p>
                        <p className="mt-0.5 text-[10px] text-amber-400/70">
                          Use cartão Visa <span className="font-mono">4235 6477 2802 5682</span>,
                          nome <span className="font-mono">APRO</span>, CVV <span className="font-mono">123</span>,
                          validade <span className="font-mono">11/30</span>, CPF <span className="font-mono">12345678909</span>.
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:bg-violet-500 active:scale-[0.98]"
                      >
                        Confirmar pagamento
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep('choose')}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
                      >
                        ←
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ---- PIX loading ---- */}
              {step === 'pix-loading' && (
                <div className="flex flex-col items-center gap-5 py-6">
                  <div className="relative flex h-20 w-20 items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20" />
                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-emerald-400" />
                    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden="true">
                      <path
                        d="M4.5 8.5L8.5 4.5M8.5 4.5L12.5 8.5M8.5 4.5V14.5"
                        stroke="#34d399"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M19.5 15.5L15.5 19.5M15.5 19.5L11.5 15.5M15.5 19.5V9.5"
                        stroke="#34d399"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-white">Gerando QR Code PIX…</p>
                    <p className="mt-1 text-xs text-white/40">Conectando ao Mercado Pago</p>
                  </div>
                </div>
              )}

              {/* ---- Card loading ---- */}
              {step === 'card-loading' && (
                <div className="flex flex-col items-center gap-5 py-6">
                  <div className="relative flex h-20 w-20 items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-violet-500/20" />
                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-violet-400" />
                    <svg viewBox="0 0 24 24" className="h-8 w-8 fill-violet-400" aria-hidden="true">
                      <path d="M4 4a2 2 0 00-2 2v1h20V6a2 2 0 00-2-2H4z" />
                      <path
                        fillRule="evenodd"
                        d="M22 10H2v8a2 2 0 002 2h16a2 2 0 002-2v-8zM5 14a1 1 0 011-1h1a1 1 0 110 2H6a1 1 0 01-1-1zm4-1a1 1 0 100 2h2a1 1 0 100-2H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-white">Processando pagamento…</p>
                    <p className="mt-1 text-xs text-white/40">
                      Aguarde enquanto confirmamos com a operadora
                    </p>
                  </div>
                </div>
              )}

              {/* ---- PIX QR ---- */}
              {step === 'pix-qr' && pix && (
                <div>
                  <p className="mb-4 text-center text-xs text-white/40">
                    Escaneie o QR Code no seu app bancário
                  </p>
                  <div className="flex justify-center">
                    {pix.pixQrCodeBase64 ? (
                      <img
                        src={`data:image/png;base64,${pix.pixQrCodeBase64}`}
                        alt="QR Code PIX"
                        className="h-52 w-52 rounded-2xl border border-white/10 bg-white p-2"
                      />
                    ) : (
                      <div className="flex h-52 w-52 items-center justify-center rounded-2xl border border-dashed border-white/10 text-xs text-white/30">
                        QR indisponível
                      </div>
                    )}
                  </div>

                  {pix.pixQrCode && (
                    <div className="mt-4">
                      <p className="mb-1.5 text-[10px] text-white/30">
                        Ou copie o código PIX
                      </p>
                      <div className="relative">
                        <pre className="max-h-20 overflow-auto rounded-xl border border-white/10 bg-white/5 p-3 text-[10px] text-white/60 break-all whitespace-pre-wrap">
                          {pix.pixQrCode}
                        </pre>
                        <button
                          type="button"
                          onClick={() => void copyCode()}
                          className="absolute right-2 top-2 rounded-lg bg-emerald-600/80 px-2.5 py-1 text-[10px] font-medium text-white transition hover:bg-emerald-600"
                        >
                          {copied ? '✓ Copiado' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-400/80">
                    Após o pagamento PIX, aguarde alguns minutos para a confirmação automática.
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep('choose')}
                    className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
                  >
                    ← Escolher outro método
                  </button>
                </div>
              )}

              {/* ---- Success ---- */}
              {step === 'success' && (
                <div className="flex flex-col items-center gap-4 py-6 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15">
                    <svg viewBox="0 0 24 24" className="h-10 w-10 stroke-emerald-400" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-400">Pagamento confirmado!</p>
                    <p className="mt-1 text-sm text-white/50">
                      Sua fatura foi paga com sucesso.
                    </p>
                    <p className="mt-3 text-xs text-white/30">Atualizando a página…</p>
                  </div>
                </div>
              )}

              {/* ---- Error ---- */}
              {step === 'error' && (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/15">
                    <svg viewBox="0 0 24 24" className="h-8 w-8 stroke-rose-400" fill="none" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-bold text-rose-400">Falha no pagamento</p>
                    {error && (
                      <p className="text-sm leading-relaxed text-white/50">{error}</p>
                    )}
                  </div>
                  <div className="flex w-full flex-col gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('choose');
                        setError(null);
                      }}
                      className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
                    >
                      Tentar novamente
                    </button>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="w-full rounded-xl border border-white/10 py-2.5 text-sm text-white/50 transition hover:bg-white/5 hover:text-white"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {(step === 'choose' || step === 'card') && (
              <div className="border-t border-white/10 px-6 py-3">
                <div className="flex items-center justify-center gap-3 text-[10px] text-white/20">
                  <span>🔒 SSL</span>
                  <span>·</span>
                  <span>Mercado Pago</span>
                  <span>·</span>
                  <span>PCI-DSS</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
