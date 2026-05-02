'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import type { CreateSubscriptionResult } from '@/lib/api';
import { formatPrice } from '@/lib/format';

const PAYMENTS_URL =
  process.env.NEXT_PUBLIC_PAYMENTS_URL ?? 'http://127.0.0.1:3010';
const PIX_EXPIRY_MINUTES = 30;

export function PixPayment({
  result,
  onConfirmed,
  onBack,
}: {
  result: CreateSubscriptionResult;
  onConfirmed: () => void;
  onBack: () => void;
}) {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(PIX_EXPIRY_MINUTES * 60);
  const [status, setStatus] = useState<string>('PENDING');
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const payment = result.subscription.payments[0];
  const pixCode =
    (payment?.metadata as Record<string, unknown>)?.qr_code as string | undefined;
  const pixQrBase64 =
    (payment?.metadata as Record<string, unknown>)?.qr_code_base64 as string | undefined;

  // Countdown timer
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Poll payment status every 5s
  const checkPayment = useCallback(async () => {
    if (!payment?.id || !session?.accessToken) return;
    try {
      const res = await fetch(`${PAYMENTS_URL}/payments/${payment.id}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { status: string };
        setStatus(data.status);
        if (data.status === 'PAID') {
          clearInterval(pollRef.current);
          clearInterval(intervalRef.current);
          onConfirmed();
        }
      }
    } catch {
      // Silent retry on next poll
    }
  }, [payment?.id, session?.accessToken, onConfirmed]);

  useEffect(() => {
    pollRef.current = setInterval(checkPayment, 5000);
    return () => clearInterval(pollRef.current);
  }, [checkPayment]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const expired = secondsLeft <= 0;

  async function handleCopy() {
    if (!pixCode) return;
    await navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-2xl border border-border bg-card p-8 shadow-lg">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-foreground">Pagamento via Pix</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escaneie o QR code ou copie o codigo
        </p>
        <div className="mt-3 text-2xl font-bold text-primary">
          {formatPrice(payment?.amount ?? '0')}
        </div>
      </div>

      {/* Countdown */}
      <div
        className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-center text-sm font-medium ${
          expired
            ? 'bg-destructive/10 text-destructive'
            : secondsLeft < 300
              ? 'bg-amber-50 text-amber-700'
              : 'bg-blue-50 text-blue-700'
        }`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {expired ? (
          'Pix expirado. Gere um novo.'
        ) : (
          <>
            Expira em{' '}
            <span className="font-mono font-bold">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </>
        )}
      </div>

      {/* QR Code */}
      {!expired ? (
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            {pixQrBase64 ? (
              <img
                src={`data:image/png;base64,${pixQrBase64}`}
                alt="QR Code Pix"
                width={220}
                height={220}
              />
            ) : pixCode ? (
              <QRCodeSVG value={pixCode} size={220} level="M" />
            ) : (
              <div className="flex h-[220px] w-[220px] items-center justify-center text-sm text-muted-foreground">
                QR code indisponivel
              </div>
            )}
          </div>

          {/* Copy-paste code */}
          {pixCode ? (
            <div className="w-full">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Pix copia e cola
              </label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={pixCode}
                  className="flex h-10 flex-1 rounded-md border border-input bg-muted/50 px-3 py-2 font-mono text-xs text-foreground"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`flex h-10 items-center gap-1.5 rounded-md px-4 text-sm font-medium transition-all ${
                    copied
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                >
                  {copied ? (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copiado
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copiar
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Polling status */}
      {!expired && status === 'PENDING' ? (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Aguardando confirmacao do pagamento...
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 flex-1 items-center justify-center rounded-md border border-border text-sm font-medium text-foreground hover:bg-muted"
        >
          Voltar
        </button>
        {expired ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 flex-1 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Gerar novo Pix
          </button>
        ) : null}
      </div>
    </div>
  );
}
