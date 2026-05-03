'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button, Input, cn } from '@szdevs/ui';

import {
  CONTACT_SUBJECTS,
  CONTACT_SUBJECT_LABELS,
  contactSchema,
  type ContactFormData,
  type ContactSubject,
} from '@/lib/contato-schema';
import { formatPhoneBR } from '@/lib/phone';

/**
 * Discriminated union of the 4 states the form can be in. Encoding
 * status this way (instead of `isLoading: boolean, errorMessage: string`)
 * makes invalid combinations unrepresentable — you can never have
 * "loading with success message still showing" or similar.
 */
type SubmitState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

/**
 * Classes shared between our local `<textarea>` and `<select>` so
 * they match the styling of the shared-UI `<Input>` without having
 * to re-export anything from `@szdevs/ui`.
 */
const fieldBaseClasses =
  'flex w-full rounded-md border bg-background text-sm ring-offset-background transition-colors placeholder:text-ash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const fieldDefaultBorder = 'border-input';
const fieldErrorBorder = 'border-destructive focus-visible:ring-destructive';

export function ContactForm(): JSX.Element {
  const [state, setState] = useState<SubmitState>({ kind: 'idle' });

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    mode: 'onBlur',
    defaultValues: {
      nome: '',
      email: '',
      telefone: undefined,
      // `assunto` is intentionally undefined so the empty select
      // option is the initial state and triggers "selecione um
      // assunto" if the user submits without choosing.
      assunto: undefined as unknown as ContactSubject,
      mensagem: '',
      aceiteTermos: false as unknown as true,
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/contato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      // Try to read a JSON body even on non-2xx — the API returns
      // structured error messages we want to surface to the user.
      const body: { success?: boolean; message?: string } = await res
        .json()
        .catch(() => ({}));

      if (!res.ok || !body.success) {
        throw new Error(
          body.message ??
            'Erro ao enviar sua mensagem. Tente novamente em instantes.',
        );
      }

      setState({
        kind: 'success',
        message:
          body.message ??
          'Mensagem enviada com sucesso! Em breve entraremos em contato.',
      });
      reset();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Erro ao enviar sua mensagem. Tente novamente.';
      setState({ kind: 'error', message });
    }
  });

  const isLoading = state.kind === 'loading';

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {/* Status banners */}
      {state.kind === 'success' ? (
        <div
          role="status"
          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-300"
        >
          <p className="font-semibold">Tudo certo!</p>
          <p className="mt-1 text-emerald-300/90">{state.message}</p>
        </div>
      ) : null}

      {state.kind === 'error' ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="font-semibold">Não foi possível enviar</p>
          <p className="mt-1 opacity-90">{state.message}</p>
        </div>
      ) : null}

      {/* Nome */}
      <Input
        label="Nome completo"
        placeholder="Como devemos te chamar?"
        autoComplete="name"
        disabled={isLoading}
        error={errors.nome?.message}
        {...register('nome')}
      />

      {/* Email */}
      <Input
        label="Email"
        type="email"
        placeholder="voce@empresa.com"
        autoComplete="email"
        disabled={isLoading}
        error={errors.email?.message}
        {...register('email')}
      />

      {/*
       * Telefone — masked via Controller so the displayed value, the
       * react-hook-form state, and the final submission all stay in
       * sync. Spreading `register('telefone')` and overriding onChange
       * would leave the form state holding the raw digits, which the
       * zod regex would then reject.
       */}
      <Controller
        name="telefone"
        control={control}
        render={({ field, fieldState }) => (
          <Input
            label="Telefone (opcional)"
            type="tel"
            placeholder="(11) 91234-5678"
            autoComplete="tel"
            inputMode="tel"
            disabled={isLoading}
            hint="Formato brasileiro — preenchimento opcional"
            error={fieldState.error?.message}
            ref={field.ref}
            name={field.name}
            onBlur={field.onBlur}
            value={field.value ?? ''}
            onChange={(e) => field.onChange(formatPhoneBR(e.target.value))}
          />
        )}
      />

      {/* Assunto */}
      <div className="flex w-full flex-col gap-1.5">
        <label
          htmlFor="contato-assunto"
          className="text-sm font-medium text-foreground"
        >
          Assunto
        </label>
        <select
          id="contato-assunto"
          disabled={isLoading}
          aria-invalid={errors.assunto ? 'true' : undefined}
          className={cn(
            fieldBaseClasses,
            'h-10 px-3 py-2',
            errors.assunto ? fieldErrorBorder : fieldDefaultBorder,
          )}
          defaultValue=""
          {...register('assunto')}
        >
          <option value="" disabled>
            Selecione um assunto
          </option>
          {CONTACT_SUBJECTS.map((key) => (
            <option key={key} value={key}>
              {CONTACT_SUBJECT_LABELS[key]}
            </option>
          ))}
        </select>
        {errors.assunto ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.assunto.message}
          </p>
        ) : null}
      </div>

      {/* Mensagem */}
      <div className="flex w-full flex-col gap-1.5">
        <label
          htmlFor="contato-mensagem"
          className="text-sm font-medium text-foreground"
        >
          Mensagem
        </label>
        <textarea
          id="contato-mensagem"
          rows={6}
          disabled={isLoading}
          placeholder="Conte pra gente sobre o seu projeto, contexto e prazos…"
          aria-invalid={errors.mensagem ? 'true' : undefined}
          className={cn(
            fieldBaseClasses,
            'min-h-[8rem] resize-y px-3 py-2',
            errors.mensagem ? fieldErrorBorder : fieldDefaultBorder,
          )}
          {...register('mensagem')}
        />
        {errors.mensagem ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.mensagem.message}
          </p>
        ) : (
          <p className="text-xs text-ash">
            Mínimo de 20 caracteres.
          </p>
        )}
      </div>

      {/* Aceite de termos */}
      <div className="flex flex-col gap-1.5">
        <label className="flex items-start gap-3 text-sm text-ash">
          <input
            type="checkbox"
            disabled={isLoading}
            className="mt-0.5 h-4 w-4 rounded border-input bg-background text-primary accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            {...register('aceiteTermos')}
          />
          <span>
            Li e concordo com os{' '}
            <a
              href="/termos"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              termos de uso
            </a>{' '}
            e com a{' '}
            <a
              href="/privacidade"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              política de privacidade
            </a>
            .
          </span>
        </label>
        {errors.aceiteTermos ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.aceiteTermos.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" loading={isLoading} className="w-full">
        {isLoading ? 'Enviando…' : 'Enviar mensagem'}
      </Button>
    </form>
  );
}
