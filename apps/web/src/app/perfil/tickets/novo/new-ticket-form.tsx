'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@devtechs/ui';

import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type TicketCategory,
  type TicketPriority,
} from '@/lib/support-api';

const schema = z.object({
  titulo: z
    .string()
    .min(5, 'O título precisa de ao menos 5 caracteres')
    .max(120, 'O título não pode passar de 120 caracteres'),
  descricao: z
    .string()
    .min(20, 'A descrição precisa de ao menos 20 caracteres')
    .max(2000, 'A descrição não pode passar de 2000 caracteres'),
  categoria: z.enum(TICKET_CATEGORIES),
  prioridade: z.enum(TICKET_PRIORITIES),
});

type FormValues = z.infer<typeof schema>;

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  BUG: 'Bug ou erro',
  FEATURE: 'Sugestão de feature',
  QUESTION: 'Dúvida',
  BILLING: 'Financeiro',
  OTHER: 'Outros',
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export function NewTicketForm({
  accessToken,
}: {
  accessToken: string;
}): JSX.Element {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      titulo: '',
      descricao: '',
      categoria: 'QUESTION',
      prioridade: 'MEDIUM',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      // We POST to the support-service directly from the client to
      // avoid creating an extra Next.js route — the access token is
      // already in the user's NextAuth session and gets attached
      // here via Authorization header. The token does NOT travel via
      // any DOM attribute.
      const supportUrl =
        process.env.NEXT_PUBLIC_SUPPORT_URL ?? 'http://127.0.0.1:4008';
      const res = await fetch(`${supportUrl}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: values.titulo,
          description: values.descricao,
          category: values.categoria,
          priority: values.prioridade,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string | string[];
        };
        const message = Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message ?? 'Falha ao criar o chamado';
        setSubmitError(message);
        return;
      }
      router.push('/perfil/tickets');
      router.refresh();
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Erro de rede ao criar o chamado. Tente novamente.',
      );
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-5 rounded-2xl border border-white/8 bg-white/[0.04] p-6 shadow-sm md:max-w-2xl"
    >
      <div>
        <label
          htmlFor="ticket-title"
          className="block text-sm font-medium text-foreground"
        >
          Título
        </label>
        <input
          id="ticket-title"
          type="text"
          placeholder="Ex: erro ao gerar nota fiscal"
          {...register('titulo')}
          className="mt-1.5 w-full rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          maxLength={120}
        />
        {errors.titulo ? (
          <p className="mt-1 text-xs text-destructive">{errors.titulo.message}</p>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="ticket-category"
            className="block text-sm font-medium text-foreground"
          >
            Categoria
          </label>
          <select
            id="ticket-category"
            {...register('categoria')}
            className="mt-1.5 w-full rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          {errors.categoria ? (
            <p className="mt-1 text-xs text-destructive">
              {errors.categoria.message}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="ticket-priority"
            className="block text-sm font-medium text-foreground"
          >
            Prioridade
          </label>
          <select
            id="ticket-priority"
            {...register('prioridade')}
            className="mt-1.5 w-full rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          {errors.prioridade ? (
            <p className="mt-1 text-xs text-destructive">
              {errors.prioridade.message}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label
          htmlFor="ticket-description"
          className="block text-sm font-medium text-foreground"
        >
          Descrição
        </label>
        <textarea
          id="ticket-description"
          rows={8}
          placeholder="Descreva o passo-a-passo, prints, mensagens de erro, etc. Quanto mais detalhe, mais rápida a resposta."
          {...register('descricao')}
          className="mt-1.5 w-full resize-y rounded-md border border-white/8 bg-background px-3 py-2 text-sm leading-relaxed focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          maxLength={2000}
        />
        {errors.descricao ? (
          <p className="mt-1 text-xs text-destructive">
            {errors.descricao.message}
          </p>
        ) : null}
      </div>

      {submitError ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {submitError}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          disabled={submitting}
        >
          Abrir chamado
        </Button>
      </div>
    </form>
  );
}
