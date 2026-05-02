'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@devtechs/ui';

import { getProjectsServiceUrl } from '@/lib/projects-api';

interface User {
  id: string;
  name: string;
  email: string;
}

interface NewProjectFormProps {
  currentUserId: string;
  users: User[];
  accessToken: string;
}

export function NewProjectForm({ currentUserId, users, accessToken }: NewProjectFormProps): JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('PLANNING');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [endDate, setEndDate] = useState('');
  const [ownerId, setOwnerId] = useState(currentUserId);
  const [clientId, setClientId] = useState('');
  const [githubRepo, setGithubRepo] = useState('');

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim() || !startDate || !ownerId) {
      setError('Nome, data de início e responsável são obrigatórios.');
      return;
    }

    setLoading(true);
    setError(null);

    const body: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || undefined,
      status,
      startDate,
      ownerId,
    };
    if (endDate) body.endDate = endDate;
    if (clientId) body.clientId = clientId;
    if (githubRepo.trim()) body.githubRepo = githubRepo.trim();

    try {
      const serviceUrl = typeof window !== 'undefined'
        ? (process.env.NEXT_PUBLIC_PROJECTS_SERVICE_URL ?? process.env.NEXT_PUBLIC_PROJECTS_URL ?? 'http://127.0.0.1:4003')
        : getProjectsServiceUrl();
      const res = await fetch(`${serviceUrl}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.message;
        setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao criar projeto.'));
        return;
      }
      router.push(`/admin/projetos/${(data as { id: string }).id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">Projetos</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Novo projeto</h1>
      </header>

      <form onSubmit={(e) => { void handleSubmit(e); }} className="rounded-xl border border-white/8 bg-white/[0.02] divide-y divide-border/60">
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-xs font-medium text-ash">Nome do projeto *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              placeholder="ex: Portal do Cliente v2"
              className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-xs font-medium text-ash">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Descreva o objetivo do projeto…"
              className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ash">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="PLANNING">Planejamento</option>
              <option value="ACTIVE">Ativo</option>
              <option value="ON_HOLD">Pausado</option>
              <option value="COMPLETED">Concluído</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ash">Responsável *</label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              required
              className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ash">Cliente (opcional)</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="">Nenhum cliente</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ash">Data de início *</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ash">Deadline (opcional)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-xs font-medium text-ash">
              Repositório GitHub (opcional)
            </label>
            <input
              type="text"
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              placeholder="ex: https://github.com/org/repo ou org/repo"
              maxLength={500}
              className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
        </div>

        {error && (
          <div className="px-6 py-3 text-sm text-destructive">{error}</div>
        )}

        <div className="flex justify-end gap-3 px-6 py-4">
          <Button type="button" variant="ghost" onClick={() => router.push('/admin/projetos')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Criando…' : 'Criar projeto'}
          </Button>
        </div>
      </form>
    </div>
  );
}
