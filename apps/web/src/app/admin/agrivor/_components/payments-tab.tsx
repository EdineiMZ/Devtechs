'use client';

import { Badge, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@szdevs/ui';
import { useEffect, useState } from 'react';

import type { AgrivorPayment } from '@/lib/agrivor-api';

function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

function paymentStatusVariant(status: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  const s = status.toLowerCase();
  if (s === 'paid' || s === 'approved' || s === 'pago') return 'success';
  if (s === 'pending' || s === 'pendente') return 'warning';
  if (s === 'failed' || s === 'rejected' || s === 'rejeitado') return 'destructive';
  return 'secondary';
}

export function PaymentsTab(): JSX.Element {
  const [payments, setPayments] = useState<AgrivorPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const res = await fetch('/api/admin/agrivor/payments');
        if (res.ok) {
          const data = (await res.json()) as AgrivorPayment[];
          const sorted = Array.isArray(data)
            ? [...data].sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
            : [];
          setPayments(sorted);
        } else {
          setError('Falha ao carregar pagamentos.');
        }
      } catch {
        setError('Falha de conexão com o servidor.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" label="Carregando pagamentos…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
        ⚠ {error}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/[0.02] py-12 text-center text-sm text-ash">
        Nenhum pagamento encontrado.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>MP Payment ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="whitespace-nowrap text-sm">{fmtDateTime(p.paidAt)}</TableCell>
              <TableCell className="font-mono text-xs">
                {p.customerId ?? p.tenantId ?? '—'}
              </TableCell>
              <TableCell className="font-medium">{fmtCurrency(p.amount)}</TableCell>
              <TableCell>
                <Badge variant={paymentStatusVariant(p.status)}>{p.status}</Badge>
              </TableCell>
              <TableCell className="text-sm">{p.method || '—'}</TableCell>
              <TableCell className="font-mono text-xs text-ash">
                {p.mpPaymentId ?? '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
