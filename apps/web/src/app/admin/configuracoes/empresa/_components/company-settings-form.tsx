'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { updateCompanySettings } from '@/lib/auth-admin-api';
import type { CompanySettings } from '@/lib/auth-admin-api';

const schema = z.object({
  name: z.string().min(2, 'Nome da empresa obrigatório'),
  cnpj: z
    .string()
    .optional()
    .transform((v) => v?.replace(/\D/g, '') || undefined)
    .refine((v) => !v || v.length === 14, 'CNPJ deve ter 14 dígitos'),
  stateRegistration: z.string().optional(),
  municipalRegistration: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  // Address
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2, 'UF deve ter 2 letras').optional(),
  zip: z
    .string()
    .optional()
    .transform((v) => v?.replace(/\D/g, '') || undefined)
    .refine((v) => !v || v.length === 8, 'CEP deve ter 8 dígitos'),
  // Payment address
  paymentStreet: z.string().optional(),
  paymentNumber: z.string().optional(),
  paymentComplement: z.string().optional(),
  paymentNeighborhood: z.string().optional(),
  paymentCity: z.string().optional(),
  paymentState: z.string().max(2).optional(),
  paymentZip: z
    .string()
    .optional()
    .transform((v) => v?.replace(/\D/g, '') || undefined)
    .refine((v) => !v || v.length === 8, 'CEP deve ter 8 dígitos'),
  invoiceFooter: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  initial: CompanySettings | null;
  accessToken: string;
}

function formatCnpj(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function formatCep(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, '$1-$2');
}

export function CompanySettingsForm({ initial, accessToken }: Props): JSX.Element {
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sameAsMain, setSameAsMain] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema as any),
    defaultValues: {
      name: initial?.name ?? '',
      cnpj: initial?.cnpj ?? '',
      stateRegistration: initial?.stateRegistration ?? '',
      municipalRegistration: initial?.municipalRegistration ?? '',
      email: initial?.email ?? '',
      phone: initial?.phone ?? '',
      website: initial?.website ?? '',
      street: initial?.street ?? '',
      number: initial?.number ?? '',
      complement: initial?.complement ?? '',
      neighborhood: initial?.neighborhood ?? '',
      city: initial?.city ?? '',
      state: initial?.state ?? '',
      zip: initial?.zip ?? '',
      paymentStreet: initial?.paymentStreet ?? '',
      paymentNumber: initial?.paymentNumber ?? '',
      paymentComplement: initial?.paymentComplement ?? '',
      paymentNeighborhood: initial?.paymentNeighborhood ?? '',
      paymentCity: initial?.paymentCity ?? '',
      paymentState: initial?.paymentState ?? '',
      paymentZip: initial?.paymentZip ?? '',
      invoiceFooter: initial?.invoiceFooter ?? '',
    },
  });

  const mainValues = watch(['street', 'number', 'complement', 'neighborhood', 'city', 'state', 'zip']);

  function copyMainToPayment() {
    const [street, number, complement, neighborhood, city, state, zip] = mainValues;
    setValue('paymentStreet', street ?? '');
    setValue('paymentNumber', number ?? '');
    setValue('paymentComplement', complement ?? '');
    setValue('paymentNeighborhood', neighborhood ?? '');
    setValue('paymentCity', city ?? '');
    setValue('paymentState', state ?? '');
    setValue('paymentZip', zip ?? '');
    setSameAsMain(true);
  }

  async function onSubmit(data: FormData) {
    setServerError(null);
    setSuccess(false);
    const res = await updateCompanySettings(data as Partial<CompanySettings>, accessToken);
    if (res.ok) {
      setSuccess(true);
    } else {
      const err = res.data as { message?: string | string[] };
      setServerError(
        Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? 'Erro ao salvar.'),
      );
    }
  }

  const inputCls =
    'w-full rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';
  const labelCls = 'mb-1 block text-xs font-medium text-ash';
  const errCls = 'mt-1 text-xs text-red-400';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Basic info */}
      <section className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Dados cadastrais</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Razão social / Nome da empresa *</label>
            <input {...register('name')} placeholder="Empresa Ltda" className={inputCls} />
            {errors.name && <p className={errCls}>{errors.name.message}</p>}
          </div>

          <div>
            <label className={labelCls}>CNPJ</label>
            <input
              {...register('cnpj')}
              placeholder="00.000.000/0000-00"
              maxLength={18}
              onChange={(e) => {
                e.target.value = formatCnpj(e.target.value);
              }}
              className={inputCls}
            />
            {(errors as any).cnpj && <p className={errCls}>{(errors as any).cnpj.message}</p>}
          </div>

          <div>
            <label className={labelCls}>Inscrição estadual</label>
            <input {...register('stateRegistration')} placeholder="000.000.000.000" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Inscrição municipal</label>
            <input {...register('municipalRegistration')} placeholder="00000000" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>E-mail comercial</label>
            <input {...register('email')} type="email" placeholder="contato@empresa.com.br" className={inputCls} />
            {errors.email && <p className={errCls}>{errors.email.message}</p>}
          </div>

          <div>
            <label className={labelCls}>Telefone</label>
            <input {...register('phone')} placeholder="(11) 99999-9999" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Website</label>
            <input {...register('website')} placeholder="https://empresa.com.br" className={inputCls} />
            {errors.website && <p className={errCls}>{errors.website.message}</p>}
          </div>
        </div>
      </section>

      {/* Main address */}
      <section className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Endereço principal</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-2">
            <label className={labelCls}>Logradouro</label>
            <input {...register('street')} placeholder="Rua, Avenida…" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Número</label>
            <input {...register('number')} placeholder="123" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Complemento</label>
            <input {...register('complement')} placeholder="Sala 1, Andar 2…" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Bairro</label>
            <input {...register('neighborhood')} placeholder="Centro" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Cidade</label>
            <input {...register('city')} placeholder="São Paulo" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>UF</label>
            <input
              {...register('state')}
              placeholder="SP"
              maxLength={2}
              className={`${inputCls} uppercase`}
            />
            {errors.state && <p className={errCls}>{errors.state.message}</p>}
          </div>

          <div>
            <label className={labelCls}>CEP</label>
            <input
              {...register('zip')}
              placeholder="00000-000"
              maxLength={9}
              onChange={(e) => {
                e.target.value = formatCep(e.target.value);
              }}
              className={inputCls}
            />
            {(errors as any).zip && <p className={errCls}>{(errors as any).zip.message}</p>}
          </div>
        </div>
      </section>

      {/* Payment address */}
      <section className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Endereço de cobrança / pagamento</h2>
          <button
            type="button"
            onClick={copyMainToPayment}
            className="rounded-md border border-white/8 px-3 py-1 text-xs text-ash hover:text-foreground"
          >
            {sameAsMain ? '✓ Copiado do principal' : 'Copiar endereço principal'}
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-2">
            <label className={labelCls}>Logradouro</label>
            <input {...register('paymentStreet')} placeholder="Rua, Avenida…" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Número</label>
            <input {...register('paymentNumber')} placeholder="123" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Complemento</label>
            <input {...register('paymentComplement')} placeholder="Sala 1, Andar 2…" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Bairro</label>
            <input {...register('paymentNeighborhood')} placeholder="Centro" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Cidade</label>
            <input {...register('paymentCity')} placeholder="São Paulo" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>UF</label>
            <input
              {...register('paymentState')}
              placeholder="SP"
              maxLength={2}
              className={`${inputCls} uppercase`}
            />
          </div>

          <div>
            <label className={labelCls}>CEP</label>
            <input
              {...register('paymentZip')}
              placeholder="00000-000"
              maxLength={9}
              onChange={(e) => {
                e.target.value = formatCep(e.target.value);
              }}
              className={inputCls}
            />
            {(errors as any).paymentZip && (
              <p className={errCls}>{(errors as any).paymentZip.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* Invoice footer */}
      <section className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Rodapé de notas fiscais</h2>
        <div>
          <label className={labelCls}>
            Texto exibido no rodapé das faturas e NF-e (informações legais, observações, etc.)
          </label>
          <textarea
            {...register('invoiceFooter')}
            rows={4}
            placeholder="Empresa enquadrada no Simples Nacional. CNPJ: 00.000.000/0000-00."
            className={inputCls}
          />
        </div>
      </section>

      {/* Feedback */}
      {success && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          Configurações salvas com sucesso.
        </div>
      )}
      {serverError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {serverError}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {isSubmitting ? 'Salvando…' : 'Salvar configurações'}
        </button>
      </div>
    </form>
  );
}
