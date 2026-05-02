'use client';

import { useState } from 'react';

import {
  createMilestone,
  deleteMilestone,
  type MilestoneDto,
  updateMilestone,
} from '@/lib/projects-api';

interface MilestonesPanelProps {
  projectId: string;
  accessToken: string;
  initialMilestones: MilestoneDto[];
  progressPercent: number;
  canEdit: boolean;
}

export function MilestonesPanel({
  projectId,
  accessToken,
  initialMilestones,
  progressPercent: initialProgress,
  canEdit,
}: MilestonesPanelProps): JSX.Element {
  const [milestones, setMilestones] = useState<MilestoneDto[]>(initialMilestones);
  const [progress, setProgress] = useState(initialProgress);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completed = milestones.filter((m) => m.completedAt).length;
  const total = milestones.length;
  const computedPct = total > 0 ? Math.round((completed / total) * 100) : progress;
  const displayPct = total > 0 ? computedPct : progress;

  async function handleAdd(): Promise<void> {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const res = await createMilestone(
      projectId,
      { title: title.trim(), dueDate: dueDate || undefined },
      accessToken,
    );
    setSaving(false);
    if (!res.ok) {
      const msg = (res.data as { message?: string | string[] })?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao criar marco.'));
      return;
    }
    setMilestones((prev) => [...prev, res.data as MilestoneDto]);
    setTitle('');
    setDueDate('');
    setAdding(false);
  }

  async function toggleComplete(m: MilestoneDto): Promise<void> {
    const completedAt = m.completedAt ? null : new Date().toISOString();
    const res = await updateMilestone(projectId, m.id, { completedAt }, accessToken);
    if (res.ok) {
      const updated = res.data as MilestoneDto;
      setMilestones((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
      const c = milestones.filter((x) => x.id !== m.id && x.completedAt).length + (completedAt ? 1 : 0);
      setProgress(total > 0 ? Math.round((c / total) * 100) : progress);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    const res = await deleteMilestone(projectId, id, accessToken);
    if (res.ok) {
      setMilestones((prev) => prev.filter((m) => m.id !== id));
    }
  }

  const dateFmt = new Intl.DateTimeFormat('pt-BR');

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          Marcos do projeto
          <span className="ml-2 text-xs font-normal text-ash">
            {completed}/{total} concluídos
          </span>
        </h3>
        {canEdit && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs text-sky-400 hover:underline"
          >
            + Adicionar marco
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-xs text-ash">
          <span>Progresso geral</span>
          <span className="font-medium text-foreground">{displayPct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${displayPct}%` }}
          />
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {milestones.length === 0 && (
          <p className="text-xs text-ash">Nenhum marco definido ainda.</p>
        )}
        {milestones.map((m) => (
          <div
            key={m.id}
            className="flex items-start gap-3 rounded-lg border border-white/8 bg-background/40 px-3 py-2"
          >
            {canEdit ? (
              <button
                type="button"
                onClick={() => void toggleComplete(m)}
                className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 transition ${
                  m.completedAt
                    ? 'border-emerald-500 bg-emerald-500'
                    : 'border-muted-foreground hover:border-emerald-400'
                }`}
                aria-label={m.completedAt ? 'Marcar como pendente' : 'Marcar como concluído'}
              />
            ) : (
              <span
                className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 ${
                  m.completedAt ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground'
                }`}
              />
            )}
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  m.completedAt ? 'text-ash line-through' : 'text-foreground'
                }`}
              >
                {m.title}
              </p>
              {m.dueDate && (
                <p className="text-[11px] text-ash">
                  Prazo: {dateFmt.format(new Date(m.dueDate))}
                  {m.completedAt
                    ? ` · Concluído em ${dateFmt.format(new Date(m.completedAt))}`
                    : ''}
                </p>
              )}
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => void handleDelete(m.id)}
                className="text-ash hover:text-destructive"
                aria-label="Remover marco"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add form */}
      {adding && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 p-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do marco *"
            className="rounded-md border border-white/8 bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-md border border-white/8 bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={saving}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setTitle(''); setDueDate(''); }}
              className="text-xs text-ash hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
