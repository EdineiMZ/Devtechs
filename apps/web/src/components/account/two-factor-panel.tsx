'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Input } from '@szdevs/ui';

import { RecoveryCodes } from '@/components/account/recovery-codes';

type Banner =
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

interface SetupSnapshot {
  qrCode: string;
  manualKey: string;
  otpauthUrl: string;
}

type DisableMode = 'totp' | 'email';

/**
 * Panel switching between two macro-states:
 *   • disabled — large CTA "Ativar 2FA"; clicking it kicks off the
 *     setup ceremony (QR + manual key + 6-digit input → enable).
 *   • enabled  — green status banner + "Desativar" + "Regenerar
 *     códigos de recuperação" actions.
 *
 * Disable section offers two modes:
 *   • Via app autenticador — password + TOTP code
 *   • Via e-mail — password + email OTP (for users who lost their device)
 */
export function TwoFactorPanel({
  initiallyEnabled,
}: {
  initiallyEnabled: boolean;
}): JSX.Element {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [setup, setSetup] = useState<SetupSnapshot | null>(null);
  const [enableCode, setEnableCode] = useState('');
  const [enableLoading, setEnableLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);

  // ----- ENABLE flow -----

  async function startSetup(): Promise<void> {
    setBanner(null);
    setSetupLoading(true);
    const res = await fetch('/api/account/2fa/setup', { method: 'POST' });
    setSetupLoading(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
      };
      const rawMsg = Array.isArray(data.message) ? (data.message[0] ?? '') : (data.message ?? '');
      if (/already enabled/i.test(rawMsg)) {
        setEnabled(true);
        router.refresh();
        return;
      }
      setBanner({ kind: 'error', message: rawMsg || 'Não foi possível iniciar a ativação.' });
      return;
    }
    setSetup((await res.json()) as SetupSnapshot);
  }

  async function confirmEnable(): Promise<void> {
    if (!setup) return;
    if (!/^\d{6}$/.test(enableCode)) {
      setBanner({
        kind: 'error',
        message: 'Informe o código de 6 dígitos do seu app autenticador.',
      });
      return;
    }
    setBanner(null);
    setEnableLoading(true);
    const res = await fetch('/api/account/2fa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: enableCode }),
    });
    setEnableLoading(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
      };
      const fallback = 'Código inválido.';
      const msg = Array.isArray(data.message)
        ? (data.message[0] ?? fallback)
        : (data.message ?? fallback);
      setBanner({ kind: 'error', message: msg });
      return;
    }
    const payload = (await res.json()) as {
      enabledAt: string;
      recoveryCodes: string[];
    };
    // Update local state immediately — no router.refresh() here to avoid a
    // race condition where the server re-fetches the profile before the
    // auth-service has committed twoFactorEnabled=true to the database.
    setEnabled(true);
    setSetup(null);
    setEnableCode('');
    setRecoveryCodes(payload.recoveryCodes);
    setBanner({
      kind: 'success',
      message:
        'Autenticação em duas etapas ativada com sucesso. Guarde os códigos de recuperação abaixo!',
    });
  }

  // ----- DISABLE flow -----

  const [disableMode, setDisableMode] = useState<DisableMode>('totp');
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);

  // Email OTP mode state
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCodeLoading, setEmailCodeLoading] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');

  function switchDisableMode(mode: DisableMode): void {
    setDisableMode(mode);
    setDisableCode('');
    setEmailOtp('');
    setEmailCodeSent(false);
    setBanner(null);
  }

  async function sendEmailCode(): Promise<void> {
    setBanner(null);
    setEmailCodeLoading(true);
    const res = await fetch('/api/account/2fa/request-email-code', { method: 'POST' });
    setEmailCodeLoading(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
      const fallback = 'Não foi possível enviar o código. Tente novamente.';
      const msg = Array.isArray(data.message)
        ? (data.message[0] ?? fallback)
        : (data.message ?? fallback);
      setBanner({ kind: 'error', message: msg });
      return;
    }
    setEmailCodeSent(true);
    setBanner({
      kind: 'success',
      message: 'Código enviado para o seu e-mail. Válido por 10 minutos.',
    });
  }

  async function disable(): Promise<void> {
    if (!disablePassword) {
      setBanner({ kind: 'error', message: 'Informe sua senha atual.' });
      return;
    }
    if (disableMode === 'totp' && !/^\d{6}$/.test(disableCode)) {
      setBanner({
        kind: 'error',
        message: 'Informe o código TOTP atual de 6 dígitos.',
      });
      return;
    }
    if (disableMode === 'email' && !/^\d{6}$/.test(emailOtp)) {
      setBanner({
        kind: 'error',
        message: 'Informe o código de 6 dígitos enviado para o seu e-mail.',
      });
      return;
    }
    setBanner(null);
    setDisableLoading(true);

    let res: Response;
    if (disableMode === 'totp') {
      res = await fetch('/api/account/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: disablePassword, code: disableCode }),
      });
    } else {
      res = await fetch('/api/account/2fa/disable-via-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: disablePassword, emailOtp }),
      });
    }

    setDisableLoading(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
      };
      const fallback = 'Não foi possível desativar a autenticação 2FA.';
      const msg = Array.isArray(data.message)
        ? (data.message[0] ?? fallback)
        : (data.message ?? fallback);
      setBanner({ kind: 'error', message: msg });
      return;
    }
    setEnabled(false);
    setDisablePassword('');
    setDisableCode('');
    setEmailOtp('');
    setEmailCodeSent(false);
    setRecoveryCodes(null);
    setBanner({
      kind: 'success',
      message:
        'Autenticação em duas etapas desativada. Recomendamos reativar assim que possível.',
    });
    router.refresh();
  }

  // ----- REGENERATE flow -----

  const [regenLoading, setRegenLoading] = useState(false);
  async function regenerate(): Promise<void> {
    setBanner(null);
    setRegenLoading(true);
    const res = await fetch('/api/account/2fa/recovery-codes', { method: 'POST' });
    setRegenLoading(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
      };
      const fallback = 'Não foi possível regenerar os códigos.';
      const msg = Array.isArray(data.message)
        ? (data.message[0] ?? fallback)
        : (data.message ?? fallback);
      setBanner({ kind: 'error', message: msg });
      return;
    }
    const payload = (await res.json()) as { recoveryCodes: string[] };
    setRecoveryCodes(payload.recoveryCodes);
    setBanner({
      kind: 'success',
      message:
        'Novos códigos de recuperação gerados. Os anteriores foram invalidados.',
    });
  }

  // -------------------------- RENDER --------------------------

  return (
    <div className="space-y-4">
      {banner ? (
        <div
          role={banner.kind === 'error' ? 'alert' : 'status'}
          className={
            banner.kind === 'success'
              ? 'rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200'
              : 'rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'
          }
        >
          {banner.message}
        </div>
      ) : null}

      {recoveryCodes ? (
        <RecoveryCodes
          codes={recoveryCodes}
          onAcknowledge={() => setRecoveryCodes(null)}
        />
      ) : null}

      {!enabled ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
          {!setup ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  2FA desativado
                </p>
                <p className="mt-1 text-xs text-ash">
                  Ative agora para proteger sua conta com um segundo fator.
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                loading={setupLoading}
                onClick={startSetup}
              >
                Ativar 2FA
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  1. Escaneie o QR code
                </h3>
                <p className="mt-1 text-xs text-ash">
                  Abra seu app autenticador e escaneie a imagem abaixo. Se o app
                  não suportar QR, digite a chave manualmente.
                </p>
              </div>

              <div className="flex flex-col items-center gap-4 rounded-xl border border-white/8 bg-background p-4 sm:flex-row sm:items-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={setup.qrCode}
                  alt="QR code para configurar 2FA"
                  className="h-44 w-44 rounded-md bg-white p-2"
                />
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-xs uppercase tracking-wider text-ash">
                    Chave manual
                  </p>
                  <code className="mt-1 inline-block break-all rounded bg-secondary/40 px-2 py-1 font-mono text-sm text-foreground">
                    {setup.manualKey}
                  </code>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  2. Digite o código de 6 dígitos
                </h3>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Input
                      label="Código TOTP"
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      autoComplete="one-time-code"
                      placeholder="000000"
                      value={enableCode}
                      onChange={(e) =>
                        setEnableCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    loading={enableLoading}
                    onClick={confirmEnable}
                  >
                    Confirmar e ativar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
            <p className="text-sm font-medium text-emerald-200">
              ✓ 2FA está ativo
            </p>
            <p className="mt-1 text-xs text-emerald-300/80">
              A cada login, você precisará informar o código de 6 dígitos do
              seu app autenticador.
            </p>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
            <h3 className="text-sm font-semibold text-foreground">
              Códigos de recuperação
            </h3>
            <p className="mt-1 text-xs text-ash">
              Use estes códigos uma única vez se perder acesso ao seu app
              autenticador. Regenerar invalida todos os anteriores.
            </p>
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={regenLoading}
                onClick={regenerate}
              >
                Regenerar códigos de recuperação
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
            <h3 className="text-sm font-semibold text-foreground">
              Desativar 2FA
            </h3>
            <p className="mt-1 text-xs text-ash">
              Escolha como confirmar sua identidade para desativar a autenticação em duas etapas.
            </p>

            {/* Mode toggle */}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => switchDisableMode('totp')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  disableMode === 'totp'
                    ? 'bg-white/10 text-foreground'
                    : 'text-ash hover:text-foreground'
                }`}
              >
                Via app autenticador
              </button>
              <button
                type="button"
                onClick={() => switchDisableMode('email')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  disableMode === 'email'
                    ? 'bg-white/10 text-foreground'
                    : 'text-ash hover:text-foreground'
                }`}
              >
                Via e-mail
              </button>
            </div>

            {disableMode === 'totp' ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Input
                  label="Senha atual"
                  type="password"
                  autoComplete="current-password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                />
                <Input
                  label="Código TOTP atual"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={disableCode}
                  onChange={(e) =>
                    setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <Input
                  label="Senha atual"
                  type="password"
                  autoComplete="current-password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                />
                {!emailCodeSent ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    loading={emailCodeLoading}
                    onClick={sendEmailCode}
                  >
                    Enviar código por e-mail
                  </Button>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <Input
                        label="Código recebido por e-mail"
                        type="text"
                        inputMode="numeric"
                        pattern="\d{6}"
                        maxLength={6}
                        autoComplete="one-time-code"
                        placeholder="000000"
                        value={emailOtp}
                        onChange={(e) =>
                          setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      loading={emailCodeLoading}
                      onClick={sendEmailCode}
                    >
                      Reenviar
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                variant="destructive"
                loading={disableLoading}
                disabled={disableMode === 'email' && !emailCodeSent}
                onClick={disable}
              >
                Desativar 2FA
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
