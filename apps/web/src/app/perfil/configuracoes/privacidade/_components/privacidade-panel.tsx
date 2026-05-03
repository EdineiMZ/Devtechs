'use client';

import { useState } from 'react';
import { Download, Trash2, Cookie, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

import { Button, Input } from '@szdevs/ui';
import { authServiceFetch, extractErrorMessage, getAuthServiceUrl } from '@/lib/auth-service';

interface Props {
  accessToken: string;
  userEmail: string;
}

type ExportStatus = 'idle' | 'loading' | 'done' | 'error';
type DeleteStatus = 'idle' | 'confirm' | 'loading' | 'error';

export function PrivacidadePanel({ accessToken, userEmail }: Props): JSX.Element {
  // ── Exportação ───────────────────────────────────────────────────
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [exportError, setExportError] = useState('');

  async function handleExport(): Promise<void> {
    setExportStatus('loading');
    setExportError('');
    try {
      const res = await fetch(`${getAuthServiceUrl()}/auth/me/export`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        setExportError(err.message ?? 'Erro ao exportar dados');
        setExportStatus('error');
        return;
      }
      const data: unknown = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `szdevs-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus('done');
    } catch {
      setExportError('Falha de conexão. Tente novamente.');
      setExportStatus('error');
    }
  }

  // ── Exclusão de conta ────────────────────────────────────────────
  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>('idle');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  async function handleDelete(): Promise<void> {
    if (!deletePassword) {
      setDeleteError('Informe sua senha atual para confirmar.');
      return;
    }
    setDeleteStatus('loading');
    setDeleteError('');

    const res = await authServiceFetch<{ message: string }>('/auth/me', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { currentPassword: deletePassword },
    });

    if (!res.ok) {
      setDeleteError(extractErrorMessage(res.data, 'Erro ao excluir conta'));
      setDeleteStatus('confirm');
      return;
    }

    // Conta excluída — redireciona para logout
    window.location.href = '/api/auth/signout?callbackUrl=/';
  }

  // ── Preferências de cookies ───────────────────────────────────────
  const [cookiePreference, setCookiePreference] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('szdevs_cookie_consent') ?? 'necessary';
    }
    return 'necessary';
  });

  function saveCookiePreference(pref: 'all' | 'necessary'): void {
    localStorage.setItem('szdevs_cookie_consent', pref);
    setCookiePreference(pref);
    window.dispatchEvent(
      new CustomEvent('szdevs:cookie-consent', { detail: { consent: pref } }),
    );
  }

  return (
    <div className="space-y-6">

      {/* ── 1. Exportar dados ─────────────────────────────────────── */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
        <div className="flex items-start gap-3">
          <Download className="mt-0.5 h-5 w-5 shrink-0 text-copper" />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground">Exportar meus dados</h3>
            <p className="mt-1 text-sm text-ash">
              Baixe um arquivo JSON com todos os seus dados pessoais armazenados na plataforma —
              perfil, sessões, notificações e histórico de ações. Conforme LGPD art. 18, V
              (portabilidade).
            </p>

            {exportStatus === 'done' ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Download iniciado. Verifique sua pasta de downloads.
              </div>
            ) : exportStatus === 'error' ? (
              <p className="mt-3 text-sm text-red-400">{exportError}</p>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              loading={exportStatus === 'loading'}
              onClick={handleExport}
            >
              {exportStatus === 'loading' ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Gerando arquivo…
                </>
              ) : (
                <>
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Baixar meus dados (JSON)
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── 2. Preferências de cookies ────────────────────────────── */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-copper" />
          <div className="flex-1">
            <h3 className="font-medium text-foreground">Preferências de cookies</h3>
            <p className="mt-1 text-sm text-ash">
              Gerencie seu consentimento para cookies opcionais (LGPD art. 8º — revogação a
              qualquer momento sem prejuízo).
            </p>

            <div className="mt-4 space-y-3">
              {/* Necessários — não alterável */}
              <label className="flex items-center gap-3 cursor-not-allowed">
                <input type="checkbox" checked disabled
                  className="h-4 w-4 rounded border border-white/20 bg-copper/20 opacity-60 cursor-not-allowed" />
                <span className="text-sm text-ash/70">
                  <span className="font-medium text-ash">Estritamente necessários</span>
                  {' '}— sessão, segurança. Sempre ativos.
                </span>
              </label>

              {/* Analytics */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cookiePreference === 'all'}
                  onChange={(e) => saveCookiePreference(e.target.checked ? 'all' : 'necessary')}
                  className={[
                    'h-4 w-4 rounded border appearance-none bg-white/[0.03]',
                    'border-white/20 checked:bg-copper checked:border-copper',
                    'focus:outline-none focus:ring-1 focus:ring-copper/40 cursor-pointer transition-colors',
                  ].join(' ')}
                />
                <span className="text-sm text-ash">
                  <span className="font-medium text-foreground">Analytics</span>
                  {' '}— dados de uso agregados para melhoria da plataforma.
                </span>
              </label>
            </div>

            <p className="mt-3 text-xs text-ash/50">
              Preferência salva localmente. Para revogar em outros dispositivos, use esta
              seção em cada um deles.
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. Excluir conta ─────────────────────────────────────── */}
      <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-6">
        <div className="flex items-start gap-3">
          <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-red-400">Excluir minha conta</h3>
            <p className="mt-1 text-sm text-ash">
              Remove permanentemente sua conta e todos os dados pessoais associados (LGPD art. 18,
              VI). Esta ação é <strong className="text-foreground">irreversível</strong>. Logs de
              auditoria são mantidos anonimizados conforme Marco Civil art. 15.
            </p>

            {deleteStatus === 'idle' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 border-red-500/30 text-red-400 hover:border-red-500/60 hover:bg-red-500/10"
                onClick={() => setDeleteStatus('confirm')}
              >
                <AlertTriangle className="mr-2 h-3.5 w-3.5" />
                Excluir minha conta
              </Button>
            ) : deleteStatus === 'confirm' || deleteStatus === 'loading' ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                  <p className="text-xs text-red-300 font-medium">
                    ⚠ Você está prestes a excluir permanentemente a conta{' '}
                    <span className="font-mono">{userEmail}</span>.
                    Esta ação não pode ser desfeita.
                  </p>
                </div>

                <Input
                  label="Confirme com sua senha atual"
                  type="password"
                  placeholder="Sua senha atual"
                  autoComplete="current-password"
                  disabled={deleteStatus === 'loading'}
                  error={deleteError || undefined}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                />

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={deleteStatus === 'loading'}
                    onClick={() => {
                      setDeleteStatus('idle');
                      setDeletePassword('');
                      setDeleteError('');
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    loading={deleteStatus === 'loading'}
                    className="bg-red-600 hover:bg-red-700 text-white border-0"
                    onClick={handleDelete}
                  >
                    {deleteStatus === 'loading' ? 'Excluindo…' : 'Confirmar exclusão'}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Contato com o DPO ─────────────────────────────────────── */}
      <p className="text-center text-xs text-ash/50">
        Para exercer outros direitos (acesso, correção, oposição) ou falar com nosso{' '}
        <strong className="text-ash">Encarregado de Dados (DPO)</strong>, envie um email para{' '}
        <a href="mailto:privacidade@szdevs.com?subject=[LGPD] Direito do Titular"
          className="text-copper/70 hover:text-copper underline-offset-4 hover:underline transition-colors">
          privacidade@szdevs.com
        </a>{' '}
        com o assunto <span className="font-mono">[LGPD] Direito: [tipo]</span>.
        Respondemos em até 15 dias úteis (art. 19, §3º LGPD).
      </p>
    </div>
  );
}
