'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button, Input } from '@szdevs/ui';

import { AUTH_ERRORS } from '@/auth';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { loginSchema, type LoginInput } from '@/lib/auth-schemas';
import { authServiceFetch, extractErrorMessage } from '@/lib/auth-service';
import { getRedirectForRole } from '@/lib/role-redirect';
import { preflightLogin } from './actions';

/**
 * Credentials login form with conditional 2FA, Email OTP, OAuth fallback,
 * and structured error branching.
 *
 * Modes:
 *   CREDENTIALS (default) — email + password. If 2FA is enabled the form
 *     flips to TWO_FACTOR phase to collect the TOTP code.
 *
 *   EMAIL_OTP — passwordless login. User enters email → backend sends OTP
 *     → user enters code → signIn('email-otp') completes the session.
 */

type FormMode = 'credentials' | 'email-otp';
type CredentialsPhase = 'credentials' | 'two-factor';

type BannerState =
  | { kind: 'none' }
  | { kind: 'error'; title: string; message: string }
  | { kind: 'info'; title: string; message: string }
  | { kind: 'verify'; email: string; password: string };

function safeCallback(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return null;
}

export function LoginForm(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialError = searchParams.get('error');

  const [mode, setMode] = useState<FormMode>('credentials');
  const [phase, setPhase] = useState<CredentialsPhase>('credentials');
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(() =>
    initialError === AUTH_ERRORS.OAUTH_LINK_FAILED
      ? {
          kind: 'error',
          title: 'Não foi possível entrar',
          message:
            'O login com provedor externo falhou. Tente novamente ou use email e senha.',
        }
      : { kind: 'none' },
  );

  // Email OTP state
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: { email: '', password: '', code: '', remember: false },
  });

  // -----------------------------------------------------------------------
  // Credentials submit
  // -----------------------------------------------------------------------
  const onSubmit = handleSubmit(async (data) => {
    setBanner({ kind: 'none' });

    // ── Two-factor phase: tempToken already in state ──────────────────────
    // The user obtained a tempToken via preflight after the first submit.
    // Call signIn with tempToken+code so authorize uses the fast path
    // (/auth/2fa/verify) without re-checking the password.
    if (phase === 'two-factor') {
      if (!tempToken) {
        // Token expired — send them back to start
        setBanner({
          kind: 'error',
          title: 'Sessão expirou',
          message: 'O código temporário expirou. Inicie o login novamente.',
        });
        setPhase('credentials');
        setTempToken(null);
        return;
      }

      const result = await signIn('credentials', {
        redirect: false,
        email:     data.email,
        password:  data.password,
        code:      data.code?.trim() || undefined,
        tempToken,
      } as Parameters<typeof signIn>[1]);

      if (!result) {
        setBanner({ kind: 'error', title: 'Erro inesperado', message: 'Tente novamente.' });
        return;
      }
      if (result.error) {
        setBanner({
          kind: 'error',
          title: 'Código inválido',
          message: 'O código de verificação está incorreto ou expirou. Tente novamente.',
        });
        return;
      }
      await redirectAfterLogin();
      return;
    }

    // ── Credentials phase ─────────────────────────────────────────────────
    const result = await signIn('credentials', {
      redirect: false,
      email:    data.email,
      password: data.password,
    });

    if (!result) {
      setBanner({
        kind: 'error',
        title: 'Erro inesperado',
        message: 'Não foi possível completar o login. Tente novamente.',
      });
      return;
    }

    if (!result.error) {
      await redirectAfterLogin();
      return;
    }

    // signIn failed — NextAuth v5 normalises all authorize() errors to
    // 'CredentialsSignin', so we can't branch on result.error alone.
    // Use preflightLogin to determine the real cause.
    const preflight = await preflightLogin(data.email, data.password);

    if ('requires2FA' in preflight) {
      setTempToken(preflight.tempToken);
      setPhase('two-factor');
      setBanner({
        kind: 'info',
        title: 'Verificação em duas etapas',
        message: 'Informe o código de 6 dígitos gerado pelo seu aplicativo autenticador.',
      });
      return;
    }

    if ('error' in preflight) {
      mapAuthorizeError(preflight.error);
      return;
    }

    // Preflight said ok but signIn still failed — unexpected
    mapAuthorizeError(result.error);
  });

  const mapAuthorizeError = (error: string): void => {
    switch (error) {
      case AUTH_ERRORS.TWO_FA_REQUIRED:
        setPhase('two-factor');
        setBanner({
          kind: 'info',
          title: 'Verificação em duas etapas',
          message:
            'Informe o código de 6 dígitos gerado pelo seu aplicativo autenticador.',
        });
        return;

      case AUTH_ERRORS.EMAIL_NOT_VERIFIED:
        setBanner({
          kind: 'verify',
          email: getValues('email'),
          password: getValues('password'),
        });
        return;

      case AUTH_ERRORS.ACCOUNT_BANNED:
        setBanner({
          kind: 'error',
          title: 'Conta inativa',
          message:
            'Sua conta foi suspensa. Entre em contato com o suporte para mais informações.',
        });
        return;

      case AUTH_ERRORS.RATE_LIMITED:
        setBanner({
          kind: 'error',
          title: 'Muitas tentativas',
          message:
            'Você fez muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
        });
        return;

      default:
        setBanner({
          kind: 'error',
          title: 'Credenciais inválidas',
          message: 'Confira o email e a senha informados e tente novamente.',
        });
    }
  };

  const redirectAfterLogin = async (): Promise<void> => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      const json = (await res.json()) as {
        user?: { mainRole?: string | null; emailVerified?: boolean };
      };

      if (json?.user && json.user.emailVerified === false) {
        router.replace('/verificar-email');
        return;
      }

      const callback = safeCallback(searchParams.get('callbackUrl'));
      router.replace(callback ?? getRedirectForRole(json?.user?.mainRole));
    } catch {
      router.replace('/perfil');
    }
  };

  const handleResendVerification = async (): Promise<void> => {
    if (banner.kind !== 'verify') return;
    const signInResult = await signIn('credentials', {
      redirect: false,
      email: banner.email,
      password: banner.password,
    });
    if (!signInResult || signInResult.error) {
      setBanner({
        kind: 'error',
        title: 'Não foi possível reenviar',
        message: 'Entre novamente e tente pelo menu de configurações.',
      });
      return;
    }
    try {
      const sessionRes = await fetch('/api/auth/session', { cache: 'no-store' });
      const session = (await sessionRes.json()) as { accessToken?: string };
      if (!session.accessToken) throw new Error('no access token');
      const resend = await authServiceFetch<{ message: string }>(
        '/auth/email/send-verification',
        { headers: { Authorization: `Bearer ${session.accessToken}` } },
      );
      if (!resend.ok) throw new Error(extractErrorMessage(resend.data));
      setBanner({
        kind: 'info',
        title: 'Email reenviado',
        message: 'Confira sua caixa de entrada e clique no link para verificar.',
      });
    } catch (err) {
      setBanner({
        kind: 'error',
        title: 'Falha ao reenviar',
        message: err instanceof Error ? err.message : 'Tente novamente em instantes.',
      });
    }
  };

  // -----------------------------------------------------------------------
  // Email OTP flow
  // -----------------------------------------------------------------------
  const handleRequestOtp = async () => {
    if (!otpEmail.trim()) return;
    setBanner({ kind: 'none' });
    setOtpLoading(true);
    try {
      const res = await authServiceFetch<{ message: string }>('/auth/email-otp/request', {
        body: { email: otpEmail.trim().toLowerCase() },
      });
      if (!res.ok) {
        setBanner({
          kind: 'error',
          title: 'Erro ao enviar código',
          message: extractErrorMessage(res.data, 'Tente novamente em instantes.'),
        });
      } else {
        setOtpSent(true);
        setBanner({
          kind: 'info',
          title: 'Código enviado',
          message: `Verifique sua caixa de entrada em ${otpEmail.trim()}. O código expira em 10 minutos.`,
        });
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpEmail.trim() || otpCode.length !== 6) return;
    setBanner({ kind: 'none' });
    setOtpLoading(true);
    try {
      const result = await signIn('email-otp', {
        redirect: false,
        email: otpEmail.trim().toLowerCase(),
        code: otpCode.trim(),
      });

      if (!result || result.error) {
        setBanner({
          kind: 'error',
          title: 'Código inválido',
          message: 'O código informado está incorreto ou expirou. Solicite um novo.',
        });
        return;
      }

      await redirectAfterLogin();
    } finally {
      setOtpLoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // Mode toggle
  // -----------------------------------------------------------------------
  const switchMode = (next: FormMode) => {
    setMode(next);
    setBanner({ kind: 'none' });
    setOtpSent(false);
    setOtpCode('');
    setPhase('credentials');
    setTempToken(null);
  };

  const isCredentialsPhase = phase === 'credentials';
  const loading = isSubmitting;
  const callbackUrl = safeCallback(searchParams.get('callbackUrl')) ?? undefined;

  // -----------------------------------------------------------------------
  // Render: Email OTP mode
  // -----------------------------------------------------------------------
  if (mode === 'email-otp') {
    return (
      <div className="space-y-6">
        {/* Mode tabs */}
        <div className="flex rounded-lg border border-white/8 bg-secondary/30 p-1 text-sm">
          <button
            type="button"
            onClick={() => switchMode('credentials')}
            className="flex-1 rounded-md px-3 py-1.5 text-ash transition-colors hover:text-foreground"
          >
            Email e senha
          </button>
          <button
            type="button"
            className="flex-1 rounded-md bg-background px-3 py-1.5 font-medium shadow-sm"
          >
            Código por email
          </button>
        </div>

        {/* Banners */}
        {banner.kind === 'error' ? (
          <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-semibold">{banner.title}</p>
            <p className="mt-1 opacity-90">{banner.message}</p>
          </div>
        ) : null}
        {banner.kind === 'info' ? (
          <div role="status" className="rounded-md border border-primary/40 bg-primary/10 p-4 text-sm text-primary">
            <p className="font-semibold">{banner.title}</p>
            <p className="mt-1 opacity-90">{banner.message}</p>
          </div>
        ) : null}

        <div className="space-y-5">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            value={otpEmail}
            onChange={(e) => setOtpEmail(e.target.value)}
            disabled={otpLoading || otpSent}
          />

          {otpSent ? (
            <>
              <Input
                label="Código de acesso"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                hint="6 dígitos enviados para seu email"
                disabled={otpLoading}
              />

              <Button
                type="button"
                variant="copper"
                size="lg"
                className="w-full"
                loading={otpLoading}
                disabled={otpCode.length !== 6 || otpLoading}
                onClick={handleVerifyOtp}
              >
                {otpLoading ? 'Verificando…' : 'Entrar com código'}
              </Button>

              <button
                type="button"
                className="w-full text-xs text-ash underline-offset-4 hover:underline"
                onClick={() => {
                  setOtpSent(false);
                  setOtpCode('');
                  setBanner({ kind: 'none' });
                }}
              >
                Reenviar código
              </button>
            </>
          ) : (
            <Button
              type="button"
              variant="copper"
              size="lg"
              className="w-full"
              loading={otpLoading}
              disabled={!otpEmail.trim() || otpLoading}
              onClick={handleRequestOtp}
            >
              {otpLoading ? 'Enviando…' : 'Enviar código'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render: Credentials mode (default)
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Mode tabs (only show on credentials phase, not 2FA) */}
      {isCredentialsPhase ? (
        <div className="flex rounded-lg border border-white/8 bg-secondary/30 p-1 text-sm">
          <button
            type="button"
            className="flex-1 rounded-md bg-background px-3 py-1.5 font-medium shadow-sm"
          >
            Email e senha
          </button>
          <button
            type="button"
            onClick={() => switchMode('email-otp')}
            className="flex-1 rounded-md px-3 py-1.5 text-ash transition-colors hover:text-foreground"
          >
            Código por email
          </button>
        </div>
      ) : null}

      {/* OAuth row */}
      {isCredentialsPhase ? (
        <OAuthButtons callbackUrl={callbackUrl} disabled={loading} />
      ) : null}

      {/* Inline banners */}
      {banner.kind === 'error' ? (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-semibold">{banner.title}</p>
          <p className="mt-1 opacity-90">{banner.message}</p>
        </div>
      ) : null}

      {banner.kind === 'info' ? (
        <div role="status" className="rounded-md border border-primary/40 bg-primary/10 p-4 text-sm text-primary">
          <p className="font-semibold">{banner.title}</p>
          <p className="mt-1 opacity-90">{banner.message}</p>
        </div>
      ) : null}

      {banner.kind === 'verify' ? (
        <div role="alert" className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div>
            <p className="font-semibold">Email não verificado</p>
            <p className="mt-1 opacity-90">
              Verifique sua caixa de entrada e clique no link que enviamos. Se
              não recebeu, podemos reenviar.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-amber-500/60 text-amber-100"
            onClick={handleResendVerification}
          >
            Reenviar verificação
          </Button>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="voce@empresa.com"
          disabled={loading || phase === 'two-factor'}
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="space-y-1.5">
          <Input
            label="Senha"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            disabled={loading || phase === 'two-factor'}
            error={errors.password?.message}
            {...register('password')}
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-ash">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-input bg-background text-primary accent-primary"
                disabled={loading}
                {...register('remember')}
              />
              Lembrar de mim
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-copper/80 underline-offset-4 hover:text-copper"
            >
              Esqueci minha senha
            </Link>
          </div>
        </div>

        {phase === 'two-factor' ? (
          <Input
            label="Código de verificação"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
            disabled={loading}
            hint="6 dígitos do seu aplicativo autenticador"
            error={errors.code?.message}
            {...register('code')}
          />
        ) : null}

        <Button type="submit" variant="copper" size="lg" className="w-full" loading={loading}>
          {phase === 'two-factor'
            ? loading ? 'Verificando…' : 'Verificar código'
            : loading ? 'Entrando…' : 'Entrar'}
        </Button>

        {phase === 'two-factor' ? (
          <button
            type="button"
            className="w-full text-xs text-ash underline-offset-4 hover:underline"
            onClick={() => {
              setPhase('credentials');
              setTempToken(null);
              setBanner({ kind: 'none' });
            }}
          >
            ← Voltar ao início
          </button>
        ) : null}
      </form>
    </div>
  );
}
