'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useCallback, type FormEvent } from 'react';

import type { Plan, Coupon, CreateSubscriptionResult } from '@/lib/api';
import { createSubscription } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { CouponField } from './coupon-field';
import { MethodSelector } from './method-selector';
import { PixPayment } from './pix-payment';
import { PaymentSuccess } from './payment-success';

type PaymentMethodType = 'PIX' | 'BOLETO' | 'CREDIT_CARD';
type Step = 'form' | 'pix' | 'boleto' | 'success';

export function CheckoutForm({
  plan: initialPlan,
  plans,
}: {
  plan: Plan;
  plans: Plan[];
}) {
  const { data: session } = useSession();
  const router = useRouter();

  const [selectedPlan, setSelectedPlan] = useState<Plan>(initialPlan);
  const [method, setMethod] = useState<PaymentMethodType>('PIX');
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CreateSubscriptionResult | null>(null);

  const price = parseFloat(selectedPlan.price);
  const discount = coupon
    ? coupon.type === 'PERCENTAGE'
      ? price * (parseFloat(coupon.discount) / 100)
      : Math.min(parseFloat(coupon.discount), price)
    : 0;
  const finalPrice = Math.max(0, price - discount);

  const handleCouponApplied = useCallback((c: Coupon, code: string) => {
    setCoupon(c);
    setCouponCode(code);
  }, []);

  const handleCouponRemoved = useCallback(() => {
    setCoupon(null);
    setCouponCode('');
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    setError('');
    setLoading(true);

    try {
      const res = await createSubscription(
        {
          planId: selectedPlan.id,
          couponCode: couponCode || undefined,
          method,
        },
        session.accessToken,
      );
      setResult(res);

      if (method === 'PIX') {
        setStep('pix');
      } else if (method === 'BOLETO' && res.externalUrl) {
        setStep('boleto');
      } else {
        // Credit card: redirect to external checkout
        if (res.externalUrl) {
          window.location.href = res.externalUrl;
        } else {
          setStep('success');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar assinatura');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'success') {
    return <PaymentSuccess />;
  }

  if (step === 'pix' && result) {
    return (
      <PixPayment
        result={result}
        onConfirmed={() => setStep('success')}
        onBack={() => setStep('form')}
      />
    );
  }

  if (step === 'boleto' && result?.externalUrl) {
    return (
      <div className="mx-auto max-w-lg space-y-6 rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-foreground">Boleto gerado</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Pague ate o vencimento para ativar sua assinatura
          </p>
        </div>
        <a
          href={result.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Abrir boleto
        </a>
        <button
          onClick={() => router.push('/conta/assinatura')}
          className="flex h-11 w-full items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted"
        >
          Ir para minha assinatura
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-8 lg:grid-cols-5">
        {/* Left: Options */}
        <div className="space-y-6 lg:col-span-3">
          {/* Plan selection */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Plano</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan)}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    selectedPlan.id === plan.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <div className="text-sm font-semibold text-foreground">{plan.name}</div>
                  <div className="mt-1 text-lg font-bold text-primary">
                    {formatPrice(plan.price)}
                    <span className="text-xs font-normal text-muted-foreground">
                      /{plan.interval === 'YEARLY' ? 'ano' : 'mes'}
                    </span>
                  </div>
                  {plan.trialDays > 0 ? (
                    <div className="mt-1 text-xs text-emerald-600">
                      {plan.trialDays} dias gratis
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          {/* Payment method */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Forma de pagamento
            </h2>
            <MethodSelector value={method} onChange={setMethod} />
          </div>

          {/* Coupon */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Cupom de desconto
            </h2>
            <CouponField
              coupon={coupon}
              onApplied={handleCouponApplied}
              onRemoved={handleCouponRemoved}
            />
          </div>
        </div>

        {/* Right: Summary */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 rounded-2xl border border-border bg-card p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Resumo</h2>

            <div className="space-y-3 border-b border-border pb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Plano {selectedPlan.name}</span>
                <span className="font-medium text-foreground">{formatPrice(price)}</span>
              </div>
              {coupon ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-600">
                    Desconto ({coupon.type === 'PERCENTAGE'
                      ? `${coupon.discount}%`
                      : formatPrice(coupon.discount)})
                  </span>
                  <span className="font-medium text-emerald-600">
                    -{formatPrice(discount)}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-base font-semibold text-foreground">Total</span>
              <span className="text-2xl font-bold text-primary">{formatPrice(finalPrice)}</span>
            </div>

            <p className="mt-1 text-right text-xs text-muted-foreground">
              /{selectedPlan.interval === 'YEARLY' ? 'ano' : 'mes'}
            </p>

            {selectedPlan.trialDays > 0 ? (
              <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-center text-xs font-medium text-emerald-700">
                Cobranca somente apos {selectedPlan.trialDays} dias
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-50"
            >
              {loading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                `Assinar ${selectedPlan.name}`
              )}
            </button>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Pagamento seguro via Mercado Pago
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
