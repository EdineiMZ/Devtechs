'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { createEmployee, listPositions, listDepartments } from '@/lib/rh-api';
import type { PositionItem, DepartmentItem } from '@/lib/rh-api';

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().optional(),
  cpf: z.string().length(11, 'CPF deve ter 11 dígitos').regex(/^\d+$/, 'Apenas números'),
  birthDate: z.string().min(1, 'Data de nascimento obrigatória'),
  hireDate: z.string().min(1, 'Data de admissão obrigatória'),
  positionId: z.string().min(1, 'Cargo obrigatório'),
  departmentId: z.string().min(1, 'Departamento obrigatório'),
  managerId: z.string().optional(),
  salary: z
    .string()
    .optional()
    .transform((v) => (v ? parseFloat(v.replace(',', '.')) : undefined))
    .refine((v) => v === undefined || (!isNaN(v) && v >= 0), {
      message: 'Salário deve ser um valor positivo',
    }),
});

type FormData = z.infer<typeof schema>;

interface Props {
  accessToken: string;
}

const LEVEL_LABELS: Record<string, string> = {
  JUNIOR: 'Júnior',
  MID: 'Pleno',
  SENIOR: 'Sênior',
  LEAD: 'Líder',
  MANAGER: 'Gerente',
  DIRECTOR: 'Diretor',
};

export function EmployeeForm({ accessToken }: Props): JSX.Element {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [loadingRef, setLoadingRef] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Load positions and departments on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [posRes, deptRes] = await Promise.all([
        listPositions(accessToken),
        listDepartments(accessToken),
      ]);
      if (cancelled) return;
      if (posRes.ok) setPositions(posRes.data as PositionItem[]);
      if (deptRes.ok) setDepartments(deptRes.data as DepartmentItem[]);
      setLoadingRef(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [accessToken]);

  // Auto-fill salary from position band when a position is selected
  const positionId = watch('positionId');
  useEffect(() => {
    if (!positionId) return;
    const pos = positions.find((p) => p.id === positionId);
    if (pos?.salary) {
      setValue('salary' as any, pos.salary);
    }
  }, [positionId, positions, setValue]);

  async function onSubmit(data: FormData) {
    setServerError(null);
    const res = await createEmployee(
      {
        name: data.name,
        email: data.email,
        phone: data.phone,
        cpf: data.cpf,
        birthDate: data.birthDate,
        hireDate: data.hireDate,
        positionId: data.positionId,
        departmentId: data.departmentId,
        managerId: data.managerId,
        salary: data.salary as unknown as number | undefined,
      },
      accessToken,
    );
    if (res.ok) {
      const emp = res.data as { id: string };
      router.push(`/admin/rh/funcionarios/${emp.id}`);
    } else {
      const errData = res.data as { message?: string | string[] };
      setServerError(
        Array.isArray(errData.message)
          ? errData.message.join(', ')
          : (errData.message ?? 'Erro ao salvar funcionário.'),
      );
    }
  }

  const inputCls =
    'w-full rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';
  const labelCls = 'mb-1 block text-xs font-medium text-ash';

  const field = (
    id: string,
    label: string,
    type = 'text',
    placeholder?: string,
    required = false,
  ) => (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        {...register(id as any)}
        className={inputCls}
      />
      {(errors as any)[id] && (
        <p className="mt-1 text-xs text-red-400">{(errors as any)[id]?.message}</p>
      )}
    </div>
  );

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-6 rounded-xl border border-white/8 bg-white/[0.02] p-6 lg:grid-cols-2"
    >
      {/* ── Dados pessoais ── */}
      <div className="col-span-full">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          Dados pessoais
        </p>
      </div>

      {field('name', 'Nome completo', 'text', 'João da Silva', true)}
      {field('email', 'E-mail corporativo', 'email', 'joao@empresa.com', true)}
      {field('phone', 'Telefone', 'tel', '(11) 99999-9999')}
      {field('cpf', 'CPF (somente dígitos)', 'text', '00000000000', true)}
      {field('birthDate', 'Data de nascimento', 'date', undefined, true)}

      {/* ── Vínculo empregatício ── */}
      <div className="col-span-full mt-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          Vínculo empregatício
        </p>
      </div>

      {field('hireDate', 'Data de admissão', 'date', undefined, true)}

      {/* Position dropdown */}
      <div>
        <label htmlFor="positionId" className={labelCls}>
          Cargo <span className="text-red-400">*</span>
        </label>
        <select
          id="positionId"
          {...register('positionId')}
          disabled={loadingRef}
          className={inputCls}
        >
          <option value="">
            {loadingRef ? 'Carregando cargos…' : 'Selecione o cargo'}
          </option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {LEVEL_LABELS[p.level] ?? p.level}
              {p.salary ? ` (R$ ${Number(p.salary).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : ''}
            </option>
          ))}
        </select>
        {errors.positionId && (
          <p className="mt-1 text-xs text-red-400">{errors.positionId.message}</p>
        )}
        {positions.length === 0 && !loadingRef && (
          <p className="mt-1 text-xs text-amber-400">
            Nenhum cargo cadastrado.{' '}
            <a href="/admin/rh/cargos" className="underline">
              Cadastre um cargo primeiro.
            </a>
          </p>
        )}
      </div>

      {/* Department dropdown */}
      <div>
        <label htmlFor="departmentId" className={labelCls}>
          Departamento <span className="text-red-400">*</span>
        </label>
        <select
          id="departmentId"
          {...register('departmentId')}
          disabled={loadingRef}
          className={inputCls}
        >
          <option value="">
            {loadingRef ? 'Carregando departamentos…' : 'Selecione o departamento'}
          </option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {d.managerName ? ` — Gestor: ${d.managerName}` : ''}
            </option>
          ))}
        </select>
        {errors.departmentId && (
          <p className="mt-1 text-xs text-red-400">{errors.departmentId.message}</p>
        )}
        {departments.length === 0 && !loadingRef && (
          <p className="mt-1 text-xs text-amber-400">
            Nenhum departamento cadastrado.{' '}
            <a href="/admin/rh/departamentos" className="underline">
              Cadastre um departamento primeiro.
            </a>
          </p>
        )}
      </div>

      {/* Salary */}
      <div>
        <label htmlFor="salary" className={labelCls}>
          Salário individual (R$)
          <span className="ml-1 text-[10px] text-ash">
            — Preenchido automaticamente pela faixa do cargo
          </span>
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ash">
            R$
          </span>
          <input
            id="salary"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            {...register('salary' as any)}
            className={`${inputCls} pl-9`}
          />
        </div>
        <p className="mt-1 text-[11px] text-ash">
          Este valor é usado pelo Financeiro para lançamentos automáticos de folha.
        </p>
        {(errors as any).salary && (
          <p className="mt-1 text-xs text-red-400">{(errors as any).salary?.message}</p>
        )}
      </div>

      {/* Manager ID (optional free text since managers are employees) */}
      <div>
        <label htmlFor="managerId" className={labelCls}>
          ID do gestor (opcional)
        </label>
        <input
          id="managerId"
          {...register('managerId')}
          placeholder="cuid do funcionário gestor"
          className={inputCls}
        />
        <p className="mt-1 text-[11px] text-ash">
          Cole o ID do funcionário que será gestor direto desta pessoa.
        </p>
      </div>

      {serverError && (
        <div className="col-span-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {serverError}
        </div>
      )}

      <div className="col-span-full flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting || loadingRef}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {isSubmitting ? 'Salvando…' : 'Salvar funcionário'}
        </button>
        <a
          href="/admin/rh/funcionarios"
          className="rounded-lg border border-white/8 px-5 py-2 text-sm font-medium text-ash hover:text-foreground"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}
