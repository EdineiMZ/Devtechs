'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, cn } from '@devtechs/ui';

import { fmtDate, fmtDateTime } from '@/lib/fmt-date';

import type { VpsListItem } from '../vps-list';

// ---------------------------------------------------------------------------
// Types mirrored from `developer-service/src/modules/vps/hostinger-api.service`
// ---------------------------------------------------------------------------

export interface HostingerMetricsPoint {
  timestamp: string;
  cpuPercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  diskUsedGb: number;
  diskTotalGb: number;
  networkInKbps: number;
  networkOutKbps: number;
}

export interface HostingerMetricsResponse {
  vmId: string;
  windowStart: string;
  windowEnd: string;
  granularity: '1m' | '5m' | '1h';
  points: HostingerMetricsPoint[];
}

interface HostingerAction {
  id: string;
  type: string;
  status: string;
  initiatedBy: string | null;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

interface HostingerSnapshot {
  id: string;
  vmId: string;
  label: string;
  sizeBytes: number;
  createdAt: string;
}

interface HostingerBackup {
  id: string;
  vmId: string;
  type: 'AUTOMATIC' | 'MANUAL' | string;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string | null;
}

interface HostingerPtrRecord {
  ipAddress: string;
  ptr: string | null;
}

interface HostingerOsTemplate {
  id: number;
  name: string;
  description: string;
}

interface HostingerSshKey {
  id: number;
  name: string;
  fingerprint: string;
  createdAt: string;
}

interface DetailPayload {
  vps: VpsListItem;
  metrics: HostingerMetricsResponse | null;
}

interface Props {
  id: string;
  initial: DetailPayload | null;
  error: string | null;
}

type Tab = 'overview' | 'history' | 'snapshots' | 'backups' | 'ptr' | 'reinstall';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VpsDetailView({ id, initial, error }: Props): JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ action: string; label: string; onConfirm: () => void } | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  // Tab data
  const [actions, setActions] = useState<HostingerAction[]>([]);
  const [snapshots, setSnapshots] = useState<HostingerSnapshot[]>([]);
  const [backups, setBackups] = useState<HostingerBackup[]>([]);
  const [ptrRecords, setPtrRecords] = useState<HostingerPtrRecord[]>([]);
  const [osTemplates, setOsTemplates] = useState<HostingerOsTemplate[]>([]);
  const [sshKeys, setSshKeys] = useState<HostingerSshKey[]>([]);

  // Form state
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [reinstallTemplateId, setReinstallTemplateId] = useState<number | null>(null);
  const [reinstallSshKeyIds, setReinstallSshKeyIds] = useState<number[]>([]);
  const [ptrEdit, setPtrEdit] = useState<{ ipAddress: string; ptr: string } | null>(null);

  if (!initial) {
    return (
      <Card className="border-red-500/30 bg-red-500/5">
        <CardContent className="py-6 text-sm text-red-300">
          {error ?? 'Detalhes indisponíveis.'}
        </CardContent>
      </Card>
    );
  }

  const { vps, metrics } = initial;

  // ---------------------------------------------------------------------------
  // Generic helpers
  // ---------------------------------------------------------------------------

  function showToast(tone: 'success' | 'error', message: string): void {
    setToast({ tone, message });
    setTimeout(() => setToast(null), 5000);
  }

  async function callAction(action: 'start' | 'stop' | 'restart'): Promise<void> {
    setBusy(action);
    try {
      const r = await fetch(`/api/admin/vps/${id}/${action}`, { method: 'POST' });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        showToast('error', (body as { message?: string }).message ?? 'Falha ao executar ação');
        return;
      }
      const b = body as { alreadyInState?: boolean };
      showToast('success', b.alreadyInState
        ? 'A VM já estava no estado solicitado.'
        : `Ação ${action} disparada com sucesso.`);
      startTransition(() => router.refresh());
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Tab data loaders
  // ---------------------------------------------------------------------------

  async function loadActionHistory(): Promise<void> {
    const r = await fetch(`/api/admin/vps/${id}/actions`);
    const body = await r.json().catch(() => ({}));
    if (r.ok) setActions(((body as { actions?: HostingerAction[] }).actions ?? []) as HostingerAction[]);
  }

  /** Normalize an API response to an array regardless of how Hostinger wraps it. */
  function toArray<T>(body: unknown): T[] {
    if (Array.isArray(body)) return body as T[];
    // Some Hostinger endpoints wrap the list: { data: [...] } or { items: [...] }
    if (body && typeof body === 'object') {
      const obj = body as Record<string, unknown>;
      for (const key of ['data', 'items', 'results']) {
        if (Array.isArray(obj[key])) return obj[key] as T[];
      }
    }
    return [];
  }

  async function loadSnapshots(): Promise<void> {
    const r = await fetch(`/api/admin/vps/${id}/snapshots`);
    const body = await r.json().catch(() => []);
    if (r.ok) setSnapshots(toArray<HostingerSnapshot>(body));
  }

  async function loadBackups(): Promise<void> {
    const r = await fetch(`/api/admin/vps/${id}/backups`);
    const body = await r.json().catch(() => []);
    if (r.ok) setBackups(toArray<HostingerBackup>(body));
  }

  async function loadPtrRecords(): Promise<void> {
    const r = await fetch(`/api/admin/vps/${id}/ptr`);
    const body = await r.json().catch(() => []);
    if (r.ok) setPtrRecords(toArray<HostingerPtrRecord>(body));
  }

  async function loadReinstallData(): Promise<void> {
    const [tmplRes, keyRes] = await Promise.all([
      fetch('/api/admin/vps/resources/os-templates'),
      fetch('/api/admin/vps/resources/ssh-keys'),
    ]);
    if (tmplRes.ok) setOsTemplates(toArray<HostingerOsTemplate>(await tmplRes.json().catch(() => [])));
    if (keyRes.ok) setSshKeys(toArray<HostingerSshKey>(await keyRes.json().catch(() => [])));
  }

  // ---------------------------------------------------------------------------
  // Snapshot actions
  // ---------------------------------------------------------------------------

  async function createSnapshot(): Promise<void> {
    setBusy('snapshot');
    try {
      const r = await fetch(`/api/admin/vps/${id}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: snapshotLabel.trim() || undefined }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        showToast('error', (body as { message?: string }).message ?? 'Falha ao criar snapshot');
        return;
      }
      showToast('success', `Snapshot criado: ${(body as { label?: string }).label ?? ''}`);
      setSnapshotLabel('');
      await loadSnapshots();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setBusy(null);
    }
  }

  async function deleteSnapshot(snapshotId: string): Promise<void> {
    setBusy(`del-snap-${snapshotId}`);
    try {
      const r = await fetch(`/api/admin/vps/${id}/snapshots/${snapshotId}`, { method: 'DELETE' });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        showToast('error', (body as { message?: string }).message ?? 'Falha ao excluir snapshot');
        return;
      }
      showToast('success', 'Snapshot excluído.');
      setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  async function restoreSnapshot(snapshotId: string): Promise<void> {
    setBusy(`restore-snap-${snapshotId}`);
    try {
      const r = await fetch(`/api/admin/vps/${id}/snapshots/${snapshotId}/restore`, { method: 'POST' });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        showToast('error', (body as { message?: string }).message ?? 'Falha ao restaurar snapshot');
        return;
      }
      showToast('success', 'Restauração do snapshot disparada. A VM pode reiniciar.');
      startTransition(() => router.refresh());
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Backup actions
  // ---------------------------------------------------------------------------

  async function restoreBackup(backupId: string): Promise<void> {
    setBusy(`restore-bk-${backupId}`);
    try {
      const r = await fetch(`/api/admin/vps/${id}/backups/${backupId}/restore`, { method: 'POST' });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        showToast('error', (body as { message?: string }).message ?? 'Falha ao restaurar backup');
        return;
      }
      showToast('success', 'Restauração do backup disparada. A VM pode reiniciar.');
      startTransition(() => router.refresh());
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  // ---------------------------------------------------------------------------
  // PTR actions
  // ---------------------------------------------------------------------------

  async function savePtr(): Promise<void> {
    if (!ptrEdit) return;
    setBusy('ptr');
    try {
      const r = await fetch(`/api/admin/vps/${id}/ptr`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipAddress: ptrEdit.ipAddress, ptr: ptrEdit.ptr }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        showToast('error', (body as { message?: string }).message ?? 'Falha ao atualizar PTR');
        return;
      }
      showToast('success', 'PTR atualizado com sucesso.');
      setPtrEdit(null);
      await loadPtrRecords();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setBusy(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Reinstall
  // ---------------------------------------------------------------------------

  async function performReinstall(): Promise<void> {
    if (!reinstallTemplateId) return;
    setBusy('reinstall');
    try {
      const r = await fetch(`/api/admin/vps/${id}/reinstall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: reinstallTemplateId,
          ...(reinstallSshKeyIds.length ? { sshKeyIds: reinstallSshKeyIds } : {}),
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        showToast('error', (body as { message?: string }).message ?? 'Falha ao reinstalar OS');
        return;
      }
      showToast('success', 'Reinstalação iniciada. A VM será reiniciada.');
      setReinstallTemplateId(null);
      setReinstallSshKeyIds([]);
      setConfirm(null);
      startTransition(() => router.refresh());
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setBusy(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const tabs: Array<[Tab, string]> = [
    ['overview', 'Visão geral'],
    ['history', 'Histórico'],
    ['snapshots', 'Snapshots'],
    ['backups', 'Backups'],
    ['ptr', 'PTR / DNS'],
    ['reinstall', 'Reinstalar OS'],
  ];

  return (
    <div className="space-y-5">
      {/* Header card */}
      <Card>
        <CardHeader className="border-b border-white/8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{vps.label}</CardTitle>
              <div className="mt-1 text-xs text-ash">
                {vps.hostname} · {vps.ipv4} · {vps.plan} · {vps.dataCenter}
              </div>
              <div className="mt-1 text-xs text-ash">
                Cliente: <span className="text-white/90">{vps.client.name}</span> ({vps.client.email})
              </div>
            </div>
            <StateBadge state={vps.upstream?.state} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-4">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => callAction('start')}
            disabled={busy !== null || pending}
            loading={busy === 'start'}
          >
            Iniciar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setConfirm({
                action: 'stop',
                label: 'A VM será desligada — todos os serviços ativos serão interrompidos.',
                onConfirm: () => callAction('stop'),
              })
            }
            disabled={busy !== null || pending}
            loading={busy === 'stop'}
          >
            Parar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setConfirm({
                action: 'restart',
                label: 'A VM será reiniciada — pode haver indisponibilidade de alguns minutos.',
                onConfirm: () => callAction('restart'),
              })
            }
            disabled={busy !== null || pending}
            loading={busy === 'restart'}
          >
            Reiniciar
          </Button>
        </CardContent>
      </Card>

      {toast ? (
        <div
          role="status"
          className={cn(
            'rounded-md border p-3 text-sm',
            toast.tone === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/40 bg-red-500/10 text-red-200',
          )}
        >
          {toast.message}
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-white/8">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value);
              if (value === 'history' && actions.length === 0) void loadActionHistory();
              if (value === 'snapshots' && snapshots.length === 0) void loadSnapshots();
              if (value === 'backups' && backups.length === 0) void loadBackups();
              if (value === 'ptr' && ptrRecords.length === 0) void loadPtrRecords();
              if (value === 'reinstall' && osTemplates.length === 0) void loadReinstallData();
            }}
            className={cn(
              'px-3 py-2 text-sm transition',
              tab === value
                ? 'border-b-2 border-sky-500 text-white'
                : 'text-ash hover:text-white',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? <Overview metrics={metrics} /> : null}
      {tab === 'history' ? <ActionsTimeline actions={actions} /> : null}
      {tab === 'snapshots' ? (
        <SnapshotsPane
          snapshots={snapshots}
          label={snapshotLabel}
          onLabelChange={setSnapshotLabel}
          onCreate={createSnapshot}
          onDelete={(s) =>
            setConfirm({
              action: 'delete-snapshot',
              label: `O snapshot "${s.label}" será excluído permanentemente.`,
              onConfirm: () => deleteSnapshot(s.id),
            })
          }
          onRestore={(s) =>
            setConfirm({
              action: 'restore-snapshot',
              label: `A VM será restaurada para o snapshot "${s.label}". Dados atuais serão perdidos.`,
              onConfirm: () => restoreSnapshot(s.id),
            })
          }
          busy={busy}
        />
      ) : null}
      {tab === 'backups' ? (
        <BackupsPane
          backups={backups}
          onRestore={(b) =>
            setConfirm({
              action: 'restore-backup',
              label: `A VM será restaurada para o backup de ${fmtDateTime(b.createdAt)}. Dados atuais serão perdidos.`,
              onConfirm: () => restoreBackup(b.id),
            })
          }
          busy={busy}
        />
      ) : null}
      {tab === 'ptr' ? (
        <PtrPane
          records={ptrRecords}
          editState={ptrEdit}
          onEdit={(r) => setPtrEdit({ ipAddress: r.ipAddress, ptr: r.ptr ?? '' })}
          onEditChange={(ptr) => setPtrEdit((prev) => (prev ? { ...prev, ptr } : prev))}
          onSave={savePtr}
          onCancelEdit={() => setPtrEdit(null)}
          busy={busy === 'ptr'}
        />
      ) : null}
      {tab === 'reinstall' ? (
        <ReinstallPane
          templates={osTemplates}
          sshKeys={sshKeys}
          selectedTemplateId={reinstallTemplateId}
          selectedSshKeyIds={reinstallSshKeyIds}
          onSelectTemplate={setReinstallTemplateId}
          onToggleSshKey={(kid) =>
            setReinstallSshKeyIds((prev) =>
              prev.includes(kid) ? prev.filter((k) => k !== kid) : [...prev, kid],
            )
          }
          onReinstall={() => {
            if (!reinstallTemplateId) return;
            const tmpl = osTemplates.find((t) => t.id === reinstallTemplateId);
            setConfirm({
              action: 'reinstall',
              label: `O sistema operacional da VM será reinstalado com "${tmpl?.name ?? 'template selecionado'}". TODOS OS DADOS SERÃO APAGADOS.`,
              onConfirm: performReinstall,
            });
          }}
          busy={busy === 'reinstall'}
        />
      ) : null}

      {/* Unified confirmation modal */}
      {confirm ? (
        <ConfirmModal
          label={confirm.label}
          onCancel={() => setConfirm(null)}
          onConfirm={confirm.onConfirm}
          busy={busy !== null}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StateBadge({ state }: { state: string | null | undefined }): JSX.Element {
  const map: Record<string, { label: string; className: string }> = {
    running: { label: 'Online', className: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300' },
    stopped: { label: 'Desligada', className: 'border-slate-500/30 bg-slate-500/15 text-slate-300' },
    starting: { label: 'Iniciando', className: 'border-sky-500/30 bg-sky-500/15 text-sky-300' },
    stopping: { label: 'Desligando', className: 'border-amber-500/30 bg-amber-500/15 text-amber-300' },
    rebooting: { label: 'Reiniciando', className: 'border-sky-500/30 bg-sky-500/15 text-sky-300' },
  };
  const cfg = state ? map[state] : null;
  return (
    <Badge className={cn('border', cfg?.className ?? 'border-slate-500/30 bg-slate-500/15 text-slate-300')}>
      {cfg?.label ?? state ?? '—'}
    </Badge>
  );
}

function Overview({ metrics }: { metrics: HostingerMetricsResponse | null }): JSX.Element {
  const last = metrics?.points.at(-1);
  if (!metrics || !last) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-ash">
          Métricas indisponíveis no momento. A Hostinger pode levar alguns minutos para retornar dados
          recentes após o boot da VM.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="CPU" value={`${last.cpuPercent.toFixed(1)}%`} hint="média recente" />
        <KpiCard
          label="Memória"
          value={`${(last.memoryUsedMb / 1024).toFixed(1)} / ${(last.memoryTotalMb / 1024).toFixed(1)} GB`}
          hint={`${((last.memoryUsedMb / last.memoryTotalMb) * 100).toFixed(0)}% em uso`}
        />
        <KpiCard
          label="Disco"
          value={`${last.diskUsedGb.toFixed(1)} / ${last.diskTotalGb.toFixed(0)} GB`}
          hint={`${((last.diskUsedGb / last.diskTotalGb) * 100).toFixed(0)}% em uso`}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Últimas 24h — CPU & Memória</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <SparkChart points={metrics.points} />
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }): JSX.Element {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-[11px] uppercase tracking-wider text-ash">{label}</div>
        <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
        <div className="text-xs text-ash">{hint}</div>
      </CardContent>
    </Card>
  );
}

function SparkChart({ points }: { points: HostingerMetricsPoint[] }): JSX.Element {
  const W = 720;
  const H = 220;
  const PAD_X = 28;
  const PAD_Y = 18;

  const xStep = (W - PAD_X * 2) / Math.max(1, points.length - 1);
  const yScale = (v: number): number => H - PAD_Y - (v / 100) * (H - PAD_Y * 2);
  const memPct = (p: HostingerMetricsPoint): number => (p.memoryUsedMb / p.memoryTotalMb) * 100;

  const cpuPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(PAD_X + i * xStep).toFixed(1)} ${yScale(p.cpuPercent).toFixed(1)}`)
    .join(' ');
  const memPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(PAD_X + i * xStep).toFixed(1)} ${yScale(memPct(p)).toFixed(1)}`)
    .join(' ');

  const firstPoint = points[0];
  const lastPoint = points.at(-1);
  if (!firstPoint || !lastPoint) return <div className="text-sm text-ash">sem dados</div>;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Métricas CPU e Memória das últimas 24h">
        {[0, 25, 50, 75, 100].map((y) => (
          <g key={y}>
            <line
              x1={PAD_X}
              y1={yScale(y)}
              x2={W - PAD_X}
              y2={yScale(y)}
              stroke="rgb(148 163 184 / 0.15)"
              strokeDasharray="2 4"
            />
            <text x={6} y={yScale(y) + 3} fill="rgb(148 163 184)" fontSize="10">
              {y}%
            </text>
          </g>
        ))}
        <path d={cpuPath} fill="none" stroke="rgb(56 189 248)" strokeWidth="2" />
        <path d={memPath} fill="none" stroke="rgb(110 231 183)" strokeWidth="2" />
        <text x={PAD_X} y={H - 4} fill="rgb(148 163 184)" fontSize="10">
          {fmtDateTime(firstPoint.timestamp)}
        </text>
        <text x={W - PAD_X} y={H - 4} fill="rgb(148 163 184)" fontSize="10" textAnchor="end">
          {fmtDateTime(lastPoint.timestamp)}
        </text>
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-ash">
        <span className="flex items-center gap-1">
          <span className="inline-block h-1 w-3 rounded-full bg-sky-400" /> CPU %
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1 w-3 rounded-full bg-emerald-300" /> Memória %
        </span>
      </div>
    </div>
  );
}

function ActionsTimeline({ actions }: { actions: HostingerAction[] }): JSX.Element {
  if (actions.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-ash">
          Nenhuma ação registrada para esta VM.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        {actions.map((a) => (
          <div
            key={a.id}
            className="flex items-start gap-3 rounded-md border border-white/8 bg-white/[0.02] p-3 text-sm"
          >
            <Badge className="border-white/8 bg-white/[0.02] uppercase">{a.type}</Badge>
            <div className="flex-1">
              <div className="text-white">
                {a.status} {a.errorMessage ? `· ${a.errorMessage}` : ''}
              </div>
              <div className="text-xs text-ash">
                {fmtDateTime(a.startedAt)}
                {a.completedAt ? ` → concluiu em ${fmtDateTime(a.completedAt)}` : ''}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SnapshotsPane({
  snapshots,
  label,
  onLabelChange,
  onCreate,
  onDelete,
  onRestore,
  busy,
}: {
  snapshots: HostingerSnapshot[];
  label: string;
  onLabelChange: (v: string) => void;
  onCreate: () => void;
  onDelete: (s: HostingerSnapshot) => void;
  onRestore: (s: HostingerSnapshot) => void;
  busy: string | null;
}): JSX.Element {
  return (
    <Card>
      <CardHeader className="border-b border-white/8">
        <CardTitle className="text-sm font-medium">Snapshots</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Label (ex: pre-deploy 2026-04)"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            className="h-9 flex-1 rounded-md border border-white/8 bg-white/[0.02] px-3 text-sm text-white outline-none focus:border-sky-500/60"
            maxLength={120}
          />
          <Button type="button" size="sm" onClick={onCreate} loading={busy === 'snapshot'} disabled={busy !== null}>
            Criar snapshot
          </Button>
        </div>
        <div className="space-y-2">
          {snapshots.length === 0 ? (
            <p className="text-sm text-ash">Nenhum snapshot. Clique em "Criar snapshot" para começar.</p>
          ) : (
            snapshots.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-md border border-white/8 bg-white/[0.02] p-3 text-sm"
              >
                <div>
                  <div className="text-white">{s.label}</div>
                  <div className="text-xs text-ash">
                    {(s.sizeBytes / 1024 / 1024 / 1024).toFixed(2)} GB · {fmtDateTime(s.createdAt)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onRestore(s)}
                    loading={busy === `restore-snap-${s.id}`}
                    disabled={busy !== null}
                    className="text-amber-400 hover:text-amber-300"
                  >
                    Restaurar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(s)}
                    loading={busy === `del-snap-${s.id}`}
                    disabled={busy !== null}
                    className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  >
                    Excluir
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BackupsPane({
  backups,
  onRestore,
  busy,
}: {
  backups: HostingerBackup[];
  onRestore: (b: HostingerBackup) => void;
  busy: string | null;
}): JSX.Element {
  return (
    <Card>
      <CardHeader className="border-b border-white/8">
        <CardTitle className="text-sm font-medium">Backups automáticos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-4">
        {backups.length === 0 ? (
          <p className="text-sm text-ash">
            Nenhum backup disponível. Backups automáticos aparecem aqui quando habilitados no painel da Hostinger.
          </p>
        ) : (
          backups.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-3 rounded-md border border-white/8 bg-white/[0.02] p-3 text-sm"
            >
              <div>
                <div className="text-white">
                  Backup {b.type === 'AUTOMATIC' ? 'automático' : 'manual'} ·{' '}
                  {(b.sizeBytes / 1024 / 1024 / 1024).toFixed(2)} GB
                </div>
                <div className="text-xs text-ash">
                  Criado: {fmtDateTime(b.createdAt)}
                  {b.expiresAt ? ` · Expira: ${fmtDate(b.expiresAt)}` : ''}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onRestore(b)}
                loading={busy === `restore-bk-${b.id}`}
                disabled={busy !== null}
                className="text-amber-400 hover:text-amber-300"
              >
                Restaurar
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function PtrPane({
  records,
  editState,
  onEdit,
  onEditChange,
  onSave,
  onCancelEdit,
  busy,
}: {
  records: HostingerPtrRecord[];
  editState: { ipAddress: string; ptr: string } | null;
  onEdit: (r: HostingerPtrRecord) => void;
  onEditChange: (ptr: string) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  busy: boolean;
}): JSX.Element {
  return (
    <Card>
      <CardHeader className="border-b border-white/8">
        <div>
          <CardTitle className="text-sm font-medium">PTR Records (DNS reverso)</CardTitle>
          <p className="mt-0.5 text-xs text-ash">
            Configure o hostname reverso (PTR) para cada IP da VM. Útil para servidores de e-mail e auditoria.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {records.length === 0 ? (
          <p className="text-sm text-ash">Nenhum IP encontrado. Carregue a aba para buscar os registros.</p>
        ) : (
          records.map((r) => (
            <div
              key={r.ipAddress}
              className="rounded-md border border-white/8 bg-white/[0.02] p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <code className="text-sm text-sky-300">{r.ipAddress}</code>
                  <div className="mt-0.5 text-xs text-ash">
                    PTR atual: <span className="text-white/80">{r.ptr ?? '(não configurado)'}</span>
                  </div>
                </div>
                {editState?.ipAddress !== r.ipAddress ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => onEdit(r)}>
                    Editar
                  </Button>
                ) : null}
              </div>

              {editState?.ipAddress === r.ipAddress ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={editState.ptr}
                    onChange={(e) => onEditChange(e.target.value)}
                    placeholder="ex: mail.example.com"
                    maxLength={253}
                    className="h-9 flex-1 rounded-md border border-white/8 bg-background px-3 text-sm text-white outline-none focus:border-sky-500/60"
                  />
                  <Button type="button" size="sm" onClick={onSave} loading={busy} disabled={busy}>
                    Salvar
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={onCancelEdit} disabled={busy}>
                    Cancelar
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ReinstallPane({
  templates,
  sshKeys,
  selectedTemplateId,
  selectedSshKeyIds,
  onSelectTemplate,
  onToggleSshKey,
  onReinstall,
  busy,
}: {
  templates: HostingerOsTemplate[];
  sshKeys: HostingerSshKey[];
  selectedTemplateId: number | null;
  selectedSshKeyIds: number[];
  onSelectTemplate: (id: number) => void;
  onToggleSshKey: (id: number) => void;
  onReinstall: () => void;
  busy: boolean;
}): JSX.Element {
  return (
    <Card>
      <CardHeader className="border-b border-white/8">
        <div>
          <CardTitle className="text-sm font-medium text-red-400">Reinstalar sistema operacional</CardTitle>
          <p className="mt-0.5 text-xs text-ash">
            A reinstalação apaga todos os dados do disco. Faça um snapshot antes de prosseguir.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        {/* OS Template selection */}
        <div>
          <label className="mb-2 block text-xs font-medium text-ash">Sistema operacional</label>
          {templates.length === 0 ? (
            <p className="text-sm text-ash">Carregando templates…</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTemplate(t.id)}
                  className={cn(
                    'rounded-md border p-3 text-left text-sm transition',
                    selectedTemplateId === t.id
                      ? 'border-sky-500/60 bg-sky-500/10 text-white'
                      : 'border-white/8 bg-white/[0.02] text-ash hover:border-white/10 hover:text-white',
                  )}
                >
                  <div className="font-medium">{t.name}</div>
                  {t.description ? <div className="text-xs opacity-70">{t.description}</div> : null}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* SSH Keys */}
        {sshKeys.length > 0 ? (
          <div>
            <label className="mb-2 block text-xs font-medium text-ash">
              Chaves SSH para injetar (opcional)
            </label>
            <div className="space-y-1">
              {sshKeys.map((k) => (
                <label key={k.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedSshKeyIds.includes(k.id)}
                    onChange={() => onToggleSshKey(k.id)}
                    className="accent-sky-500"
                  />
                  <span className="text-white">{k.name}</span>
                  <code className="text-xs text-ash">{k.fingerprint}</code>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">
          ⚠ Ação irreversível — todos os dados no disco serão perdidos. Certifique-se de ter um backup ou snapshot recente.
        </div>

        <Button
          type="button"
          onClick={onReinstall}
          disabled={!selectedTemplateId || busy}
          loading={busy}
          className="bg-red-600 hover:bg-red-700"
        >
          Reinstalar OS
        </Button>
      </CardContent>
    </Card>
  );
}

function ConfirmModal({
  label,
  onCancel,
  onConfirm,
  busy,
}: {
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base">Confirmar ação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <p className="text-sm text-ash">{label}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={onConfirm} loading={busy}>
              Confirmar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
