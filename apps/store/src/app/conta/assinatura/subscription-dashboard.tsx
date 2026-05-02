'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import type { Subscription } from '@/lib/api';
import { cancelSubscription as apiCancel } from '@/lib/api';
import {
  formatPrice,
  formatDate,
  formatStatus,
  formatMethod,
  formatPaymentStatus,
  daysUntil,
} from '@/lib/format';
import { CancelModal } from './cancel-modal';
import { ChangePlanModal } from './change-plan-modal';

const PAYMENTS_URL =
  process.env.NEXT_PUBLIC_PAYMENTS_URL ?? 'http://127.0.0.1:3010';

export function SubscriptionDashboard() {
  const { data: session } = useSession();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchSub = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const res = await fetch(`${PAYMENTS_URL}/subscriptions/me`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (res.ok) {
        const data = (await res.json()) as Subscription;
        setSub(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    fetchSub();
  }, [fetchSub]);

  async function handleCancel() {
    if (!session?.accessToken) return;
    setCancelling(true);
    try {
      await apiCancel(session.accessToken);
      setCancelOpen(false);
      await fetchSub();
    } catch {
      // silent
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-foreground">Sem assinatura ativa</h2>
        <p className="mt-2 text-muted-foreground">
          Escolha um plano para comecar a usar a plataforma
        </p>
        <Link
          href="/planos"
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Ver planos
        </Link>
      </div>
    );
  }

  const daysLeft = daysUntil(sub.currentPeriodEnd);
  const isPastDue = sub.status === 'PAST_DUE';
  const isNearExpiry = daysLeft > 0 && daysLeft <= 7 && !isPastDue;
  const isCancelled = !!sub.cancelledAt;

  const statusColor: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700',
    TRIALING: 'bg-blue-100 text-blue-700',
    PAST_DUE: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-700',
    EXPIRED: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="space-y-6">
      {/* PAST_DUE banner */}
      {isPastDue ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <svg className="h-5 w-5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div className="flex-1">
            <p className="font-semibold text-red-800">Pagamento pendente</p>
            <p className="text-sm text-red-600">
              Regularize o pagamento para evitar a suspensao dos servicos
            </p>
          </div>
          <Link
            href={`/checkout?planId=${sub.planId}`}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Pagar agora
          </Link>
        </div>
      ) : null}

      {/* Near expiry banner */}
      {isNearExpiry ? (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <svg className="h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-semibold text-amber-800">Cobranca em {daysLeft} dias</p>
            <p className="text-sm text-amber-600">
              Proxima cobranca: {formatDate(sub.currentPeriodEnd)} -{' '}
              {formatPrice(sub.plan.price)}
            </p>
          </div>
        </div>
      ) : null}

      {/* Subscription card */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-foreground">
                  Plano {sub.plan.name}
                </h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor[sub.status] ?? 'bg-gray-100 text-gray-700'}`}
                >
                  {formatStatus(sub.status)}
                </span>
              </div>
              {sub.plan.description ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {sub.plan.description}
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {formatPrice(sub.plan.price)}
              </div>
              <div className="text-xs text-muted-foreground">
                /{sub.plan.interval === 'YEARLY' ? 'ano' : 'mes'}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">Inicio do periodo</p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                {formatDate(sub.currentPeriodStart)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">Proxima cobranca</p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                {formatDate(sub.currentPeriodEnd)}
              </p>
            </div>
            {sub.trialEnd ? (
              <div className="rounded-lg bg-blue-50 px-4 py-3">
                <p className="text-xs text-blue-600">Fim do trial</p>
                <p className="mt-0.5 text-sm font-semibold text-blue-700">
                  {formatDate(sub.trialEnd)}
                </p>
              </div>
            ) : null}
          </div>

          {isCancelled ? (
            <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Cancelada em {formatDate(sub.cancelledAt!)}. Acesso ativo ate{' '}
              {formatDate(sub.currentPeriodEnd)}.
            </div>
          ) : null}

          <div className="mt-6 flex gap-3">
            {!isCancelled ? (
              <>
                <button
                  onClick={() => setChangeOpen(true)}
                  className="flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Alterar plano
                </button>
                <button
                  onClick={() => setCancelOpen(true)}
                  className="flex h-10 items-center rounded-lg border border-destructive/30 px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  Cancelar assinatura
                </button>
              </>
            ) : (
              <Link
                href="/planos"
                className="flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Reativar assinatura
              </Link>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-xs text-muted-foreground">Total pagamentos</p>
            <p className="mt-1 text-3xl font-bold text-foreground">
              {sub.payments.length}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-xs text-muted-foreground">Dias restantes</p>
            <p className="mt-1 text-3xl font-bold text-foreground">
              {daysLeft > 0 ? daysLeft : 0}
            </p>
          </div>
        </div>
      </div>

      {/* Payment history */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Historico de pagamentos
          </h2>
        </div>
        {sub.payments.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            Nenhum pagamento registrado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Metodo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Comprovante
                  </th>
                </tr>
              </thead>
              <tbody>
                {sub.payments.map((payment) => {
                  const pStatusColor: Record<string, string> = {
                    PAID: 'bg-emerald-100 text-emerald-700',
                    PENDING: 'bg-amber-100 text-amber-700',
                    FAILED: 'bg-red-100 text-red-700',
                    REFUNDED: 'bg-purple-100 text-purple-700',
                    EXPIRED: 'bg-gray-100 text-gray-600',
                  };

                  return (
                    <tr key={payment.id} className="border-b border-border/50">
                      <td className="px-6 py-4 text-foreground">
                        {formatDate(payment.createdAt)}
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">
                        {formatPrice(payment.amount)}
                      </td>
                      <td className="px-6 py-4 text-foreground">
                        {formatMethod(payment.method)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${pStatusColor[payment.status] ?? 'bg-gray-100 text-gray-700'}`}
                        >
                          {formatPaymentStatus(payment.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {payment.externalUrl ? (
                          <a
                            href={payment.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            Ver
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      <CancelModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        loading={cancelling}
        periodEnd={sub.currentPeriodEnd}
      />

      {/* Change Plan Modal */}
      <ChangePlanModal
        open={changeOpen}
        onClose={() => setChangeOpen(false)}
        currentPlanId={sub.planId}
      />
    </div>
  );
}
