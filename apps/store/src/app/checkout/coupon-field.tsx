'use client';

import { useSession } from 'next-auth/react';
import { useState, type FormEvent } from 'react';

import type { Coupon } from '@/lib/api';

const PAYMENTS_URL =
  process.env.NEXT_PUBLIC_PAYMENTS_URL ?? 'http://127.0.0.1:3010';

export function CouponField({
  coupon,
  onApplied,
  onRemoved,
}: {
  coupon: Coupon | null;
  onApplied: (c: Coupon, code: string) => void;
  onRemoved: () => void;
}) {
  const { data: session } = useSession();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleValidate(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || !session?.accessToken) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetch(
        `${PAYMENTS_URL}/coupons/validate?code=${encodeURIComponent(code.trim())}`,
        {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message ?? 'Cupom invalido');
      }

      const data = (await res.json()) as Coupon;
      onApplied(data, code.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cupom invalido ou expirado');
    } finally {
      setLoading(false);
    }
  }

  if (coupon) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div>
          <span className="text-sm font-semibold text-emerald-700">
            {code.toUpperCase()}
          </span>
          <span className="ml-2 text-sm text-emerald-600">
            {coupon.type === 'PERCENTAGE'
              ? `${coupon.discount}% de desconto`
              : `R$ ${coupon.discount} de desconto`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setCode('');
            onRemoved();
          }}
          className="text-sm font-medium text-emerald-700 hover:text-emerald-900"
        >
          Remover
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Digite o codigo do cupom"
          className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <button
          type="button"
          onClick={handleValidate}
          disabled={loading || !code.trim()}
          className="flex h-10 items-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            'Aplicar'
          )}
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
