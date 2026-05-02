'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { getFinanceServiceUrl } from '@/lib/finance-api';

const schema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  category: z.enum(['SALARY', 'SERVICE', 'PRODUCT', 'TAX', 'INFRA', 'MARKETING', 'OTHER']),
  description: z.string().min(2, 'Descrição obrigatória'),
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  date: z.string().min(1, 'Data obrigatória'),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  accessToken: string;
}

export function TransactionForm({ accessToken }: Props): JSX.Element {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'INCOME', category: 'SERVICE', date: new Date().toISOString().slice(0, 10) },
  });

  async function onSubmit(data: FormData) {
    setServerError(null);
    try {
      const res = await fetch(`${getFinanceServiceUrl()}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        router.push('/admin/financeiro/transacoes');
        router.refresh();
      } else {
        const err = (await res.json()) as { message?: string | string[] };
        setServerError(
          Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? 'Erro ao salvar.'),
        );
      }
    } catch {
      setServerError('Erro de conexão com o servidor.');
    }
  }

  const labelCls = 'mb-1 block text-xs font-medium text-ash';
  const inputCls =
    'w-full rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';
  const errCls = 'mt-1 text-xs text-red-400';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-6 rounded-xl border border-white/8 bg-white/[0.02] p-6 lg:grid-cols-2"
    >
      <div>
        <label className={labelCls}>Tipo *</label>
        <select {...register('type')} className={inputCls}>
          <option value="INCOME">Receita</option>
          <option value="EXPENSE">Despesa</option>
        </select>
        {errors.type && <p className={errCls}>{errors.type.message}</p>}
      </div>

      <div>
        <label className={labelCls}>Categoria *</label>
        <select {...register('category')} className={inputCls}>
          <option value="SERVICE">Serviço</option>
          <option value="PRODUCT">Produto</option>
          <option value="SALARY">Salário</option>
          <option value="TAX">Imposto</option>
          <option value="INFRA">Infraestrutura</option>
          <option value="MARKETING">Marketing</option>
          <option value="OTHER">Outro</option>
        </select>
        {errors.category && <p className={errCls}>{errors.category.message}</p>}
      </div>

      <div className="col-span-full">
        <label className={labelCls}>Descrição *</label>
        <input {...register('description')} placeholder="Pagamento de serviço…" className={inputCls} />
        {errors.description && <p className={errCls}>{errors.description.message}</p>}
      </div>

      <div>
        <label className={labelCls}>Valor (R$) *</label>
        <input
          {...register('amount')}
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0,00"
          className={inputCls}
        />
        {errors.amount && <p className={errCls}>{errors.amount.message}</p>}
      </div>

      <div>
        <label className={labelCls}>Data *</label>
        <input {...register('date')} type="date" className={inputCls} />
        {errors.date && <p className={errCls}>{errors.date.message}</p>}
      </div>

      <div>
        <label className={labelCls}>Status</label>
        <select {...register('status')} className={inputCls}>
          <option value="PENDING">Pendente</option>
          <option value="PAID">Pago</option>
        </select>
      </div>

      <div className="col-span-full">
        <label className={labelCls}>Observações</label>
        <textarea
          {...register('notes')}
          rows={3}
          placeholder="Observações adicionais…"
          className={inputCls}
        />
      </div>

      {serverError && (
        <div className="col-span-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {serverError}
        </div>
      )}

      <div className="col-span-full flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {isSubmitting ? 'Salvando…' : 'Salvar lançamento'}
        </button>
        <a
          href="/admin/financeiro/transacoes"
          className="rounded-lg border border-white/8 px-5 py-2 text-sm font-medium text-ash hover:text-foreground"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}
