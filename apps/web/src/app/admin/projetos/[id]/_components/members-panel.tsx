'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@devtechs/ui';

import { getAuthServiceUrl } from '@/lib/auth-service';
import {
  addProjectMember,
  removeProjectMember,
  updateProjectMember,
  type ProjectMemberDto,
  type ProjectMemberRole,
} from '@/lib/projects-api';

// ---------------------------------------------------------------------------
// Role metadata
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: { value: ProjectMemberRole; label: string }[] = [
  { value: 'MANAGER', label: 'Gerente' },
  { value: 'DEVELOPER', label: 'Desenvolvedor' },
  { value: 'DESIGNER', label: 'Designer' },
  { value: 'QA_ENGINEER', label: 'QA Engineer' },
  { value: 'SECURITY_ENGINEER', label: 'Eng. de Segurança' },
  { value: 'DEVOPS', label: 'DevOps' },
  { value: 'VIEWER', label: 'Visualizador' },
];

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Proprietário',
  MANAGER: 'Gerente',
  DEVELOPER: 'Desenvolvedor',
  DESIGNER: 'Designer',
  QA_ENGINEER: 'QA Engineer',
  SECURITY_ENGINEER: 'Eng. de Segurança',
  DEVOPS: 'DevOps',
  VIEWER: 'Visualizador',
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  MANAGER: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  DEVELOPER: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  DESIGNER: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  QA_ENGINEER: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  SECURITY_ENGINEER: 'bg-red-500/15 text-red-400 border-red-500/30',
  DEVOPS: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  VIEWER: 'bg-white/5 text-ash border-white/8',
};

// ---------------------------------------------------------------------------
// Avatar initials helper
// ---------------------------------------------------------------------------

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0] ?? '';
    const last = parts[parts.length - 1] ?? '';
    return parts.length >= 2
      ? (first.charAt(0) + last.charAt(0)).toUpperCase()
      : first.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function avatarColor(id: string): string {
  const colors = [
    'bg-violet-600',
    'bg-sky-600',
    'bg-emerald-600',
    'bg-pink-600',
    'bg-amber-600',
    'bg-rose-600',
    'bg-indigo-600',
    'bg-teal-600',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length] ?? 'bg-violet-600';
}

// ---------------------------------------------------------------------------
// User search — calls auth-service /users
// ---------------------------------------------------------------------------

interface UserSearchResult {
  id: string;
  name: string | null;
  email: string;
  roles: string[];
}

async function searchUsers(q: string, accessToken: string): Promise<UserSearchResult[]> {
  const url = `${getAuthServiceUrl()}/users?q=${encodeURIComponent(q)}&pageSize=20`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json() as { items: UserSearchResult[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MembersPanelProps {
  projectId: string;
  accessToken: string;
  initialMembers: ProjectMemberDto[];
  canEdit: boolean;
}

export function MembersPanel({
  projectId,
  accessToken,
  initialMembers,
  canEdit,
}: MembersPanelProps): JSX.Element {
  const [members, setMembers] = useState<ProjectMemberDto[]>(initialMembers);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingRole, setAddingRole] = useState<ProjectMemberRole>('DEVELOPER');
  const [pendingAdd, setPendingAdd] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [pendingRoleUpdate, setPendingRoleUpdate] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const existingIds = new Set(members.map((m) => m.user.id));

  // Debounced search
  const handleSearch = useCallback(
    (q: string) => {
      setQuery(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!q.trim()) {
        setSearchResults([]);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setSearching(true);
        const results = await searchUsers(q, accessToken);
        setSearchResults(results);
        setSearching(false);
      }, 350);
    },
    [accessToken],
  );

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  function showToast(type: 'ok' | 'err', msg: string): void {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  // Add member
  async function handleAdd(user: UserSearchResult): Promise<void> {
    if (existingIds.has(user.id)) return;
    setPendingAdd(user.id);
    const res = await addProjectMember(projectId, user.id, addingRole, accessToken);
    setPendingAdd(null);
    if (!res.ok) {
      const msg = (res.data as { message?: string })?.message ?? 'Erro ao adicionar membro.';
      showToast('err', msg);
      return;
    }
    const m = res.data as ProjectMemberDto;
    setMembers((prev) => [...prev, m]);
    showToast('ok', `${user.name ?? user.email} adicionado como ${ROLE_LABELS[addingRole]}.`);
    // Remove from search results so the user can't add twice
    setSearchResults((prev) => prev.filter((r) => r.id !== user.id));
  }

  // Remove member
  async function handleRemove(member: ProjectMemberDto): Promise<void> {
    if (member.role === 'OWNER') return;
    setPendingRemove(member.user.id);
    const res = await removeProjectMember(projectId, member.user.id, accessToken);
    setPendingRemove(null);
    if (!res.ok) {
      const msg = (res.data as { message?: string })?.message ?? 'Erro ao remover membro.';
      showToast('err', msg);
      return;
    }
    setMembers((prev) => prev.filter((m) => m.user.id !== member.user.id));
    showToast('ok', `${member.user.name ?? member.user.email} removido do projeto.`);
  }

  // Update role
  async function handleRoleChange(member: ProjectMemberDto, role: ProjectMemberRole): Promise<void> {
    if (member.role === 'OWNER') return;
    setPendingRoleUpdate(member.user.id);
    const res = await updateProjectMember(projectId, member.user.id, role, accessToken);
    setPendingRoleUpdate(null);
    if (!res.ok) {
      const msg = (res.data as { message?: string })?.message ?? 'Erro ao atualizar papel.';
      showToast('err', msg);
      return;
    }
    const updated = res.data as ProjectMemberDto;
    setMembers((prev) =>
      prev.map((m) => (m.user.id === member.user.id ? updated : m)),
    );
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          Equipe do projeto
          <span className="ml-2 rounded-full bg-white/5 px-2 py-0.5 text-xs font-normal text-ash">
            {members.length}
          </span>
        </h3>
        {canEdit && (
          <Button
            type="button"
            size="sm"
            variant={showSearch ? 'ghost' : 'outline'}
            onClick={() => {
              setShowSearch((v) => !v);
              setQuery('');
              setSearchResults([]);
            }}
          >
            {showSearch ? '✕ Fechar' : '+ Adicionar membro'}
          </Button>
        )}
      </div>

      {/* Member list */}
      <ul className="space-y-2">
        {members.map((member) => (
          <li
            key={member.user.id}
            className="flex items-center gap-3 rounded-xl border border-white/8 bg-background/50 px-3 py-2.5"
          >
            {/* Avatar */}
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(member.user.id)}`}
            >
              {initials(member.user.name, member.user.email)}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {member.user.name ?? member.user.email}
              </p>
              {member.user.name && (
                <p className="truncate text-[11px] text-ash">
                  {member.user.email}
                </p>
              )}
            </div>

            {/* Role badge / selector */}
            {canEdit && member.role !== 'OWNER' ? (
              <select
                value={member.role}
                disabled={pendingRoleUpdate === member.user.id}
                onChange={(e) =>
                  void handleRoleChange(member, e.target.value as ProjectMemberRole)
                }
                className="rounded-md border border-white/8 bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <span
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${ROLE_COLORS[member.role] ?? ROLE_COLORS['VIEWER']}`}
              >
                {ROLE_LABELS[member.role] ?? member.role}
              </span>
            )}

            {/* Remove */}
            {canEdit && member.role !== 'OWNER' && (
              <button
                type="button"
                disabled={pendingRemove === member.user.id}
                onClick={() => void handleRemove(member)}
                className="ml-1 shrink-0 rounded p-1 text-ash hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                aria-label="Remover membro"
              >
                {pendingRemove === member.user.id ? (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
                ) : (
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 3l10 10M13 3L3 13" />
                  </svg>
                )}
              </button>
            )}
          </li>
        ))}

        {members.length === 0 && (
          <li className="py-4 text-center text-sm text-ash">
            Nenhum membro no projeto ainda.
          </li>
        )}
      </ul>

      {/* Search panel */}
      {showSearch && canEdit && (
        <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-violet-400">
            Buscar membro da equipe
          </p>

          {/* Role selector */}
          <div className="mb-3 flex items-center gap-2">
            <label className="text-xs text-ash whitespace-nowrap">Papel:</label>
            <select
              value={addingRole}
              onChange={(e) => setAddingRole(e.target.value as ProjectMemberRole)}
              className="rounded-md border border-white/8 bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search input */}
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            className="w-full rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground placeholder:text-ash focus:outline-none focus:ring-1 focus:ring-violet-500"
            autoFocus
          />

          {/* Results */}
          {searching && (
            <div className="mt-2 flex items-center gap-2 text-xs text-ash">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
              Buscando…
            </div>
          )}

          {!searching && searchResults.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {searchResults.map((user) => {
                const alreadyMember = existingIds.has(user.id);
                return (
                  <li
                    key={user.id}
                    className="flex items-center gap-3 rounded-lg border border-white/8 bg-background px-3 py-2"
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${avatarColor(user.id)}`}
                    >
                      {initials(user.name, user.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {user.name ?? user.email}
                      </p>
                      {user.name && (
                        <p className="truncate text-[11px] text-ash">
                          {user.email}
                        </p>
                      )}
                      {user.roles.length > 0 && (
                        <p className="mt-0.5 text-[10px] text-ash">
                          {user.roles.join(', ')}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={alreadyMember || pendingAdd === user.id}
                      loading={pendingAdd === user.id}
                      onClick={() => void handleAdd(user)}
                    >
                      {alreadyMember ? 'Já membro' : 'Adicionar'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          {!searching && query.trim() && searchResults.length === 0 && (
            <p className="mt-2 text-xs text-ash">
              Nenhum usuário encontrado para &quot;{query}&quot;.
            </p>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          role="alert"
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
            toast.type === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
