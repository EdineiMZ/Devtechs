'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { triggerPipeline } from '@/lib/devops-api';

const schema = z.object({
  projectId: z.string().min(1, 'Obrigatório'),
  owner: z.string().min(1, 'Obrigatório'),
  repo: z.string().min(1, 'Obrigatório'),
  workflowId: z.string().min(1, 'Obrigatório'),
  ref: z.string().min(1, 'Branch obrigatória'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  accessToken: string;
}

export function TriggerPipelineButton({ accessToken }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError(null);
    const res = await triggerPipeline(data, accessToken);
    if (res.ok) {
      setSuccess(true);
      reset();
      setTimeout(() => { setOpen(false); setSuccess(false); }, 2000);
    } else {
      const err = res.data as { message?: string | string[] };
      setServerError(
        Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? 'Erro ao disparar pipeline.'),
      );
    }
  }

  const inputCls =
    'w-full rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500';
  const labelCls = 'mb-1 block text-xs font-medium text-ash';
  const errCls = 'mt-1 text-xs text-red-400';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
      >
        ▶ Disparar pipeline
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/8 bg-white/[0.02] p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Disparar pipeline</h2>

            {success ? (
              <p className="text-sm text-emerald-400">Pipeline disparado com sucesso!</p>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className={labelCls}>Project ID *</label>
                  <input {...register('projectId')} className={inputCls} />
                  {errors.projectId && <p className={errCls}>{errors.projectId.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Owner *</label>
                    <input {...register('owner')} placeholder="org" className={inputCls} />
                    {errors.owner && <p className={errCls}>{errors.owner.message}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Repo *</label>
                    <input {...register('repo')} placeholder="repo-name" className={inputCls} />
                    {errors.repo && <p className={errCls}>{errors.repo.message}</p>}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Workflow ID *</label>
                  <input {...register('workflowId')} placeholder="deploy.yml" className={inputCls} />
                  {errors.workflowId && <p className={errCls}>{errors.workflowId.message}</p>}
                </div>
                <div>
                  <label className={labelCls}>Branch / Ref *</label>
                  <input {...register('ref')} placeholder="main" className={inputCls} />
                  {errors.ref && <p className={errCls}>{errors.ref.message}</p>}
                </div>

                {serverError && (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                    {serverError}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
                  >
                    {isSubmitting ? 'Disparando…' : 'Disparar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-white/8 px-4 py-2 text-sm text-ash hover:text-foreground"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
