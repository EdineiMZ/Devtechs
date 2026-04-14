'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button, Input } from '@devtechs/ui';

import { AUTH_ERRORS } from '@/auth';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { loginSchema, type LoginInput } from '@/lib/auth-schemas';
import { authServiceFetch, extractErrorMessage } from '@/lib/auth-service';
import { getRedirectForRole } from '@/lib/role-redirect';

/**
 * Credentials login form with conditional 2FA, OAuth fallback, and
 * structured error branching.
 *
 * Phases:
 *   PHASE 1 — email + password only. On submit we call `signIn` with
 *             `redirect: false` so we can introspect the result; if
 *             it succeeds we redirect on the client to a role-based
 *             route; if the authorize() function throws with the
 *             `2FA_REQUIRED` sentinel, we flip into PHASE 2.
 *
 *   PHASE 2 — same form, plus the TOTP code field. Re-submission
 *             re-runs the whole authorize() flow with `code` included.
 *
 * Side flows:
 *   - `EMAIL_NOT_VERIFIED` — show an inline banner with a
 *     "reenviar verificação" button that POSTs to auth-service
 *     /auth/email/send-verification using the provided credentials.
 *   - `ACCOUNT_BANNED` — show a banned-account notice, no retry.
 *   - `RATE_LIMITED` — show the cooldown message.
 *   - Any other error → generic "credenciais inválidas".
 */

type FormPhase = 'credentials' | 'two-factor';

type BannerState =
  | { kind: 'none' }
  | { kind: 'error'; title: string; message: string }
  | { kind: 'info'; title: string; message: string }
  | { kind: 'verify'; email: string; password: string };

/**
 * Decode a callbackUrl from the search params safely. NextAuth
 * appends this when middleware bounces anonymous users away from
 * protected routes, and we want to honor it unless it's external.
 */
function safeCallback(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return null;
}

export function LoginForm(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialError = searchParams.get('error');

  const [phase, setPhase] = useState<FormPhase>('credentials');
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

  const onSubmit = handleSubmit(async (data) => {
    setBanner({ kind: 'none' });

    const result = await signIn('credentials', {
      redirect: false,
      email: data.email,
      password: data.password,
      code: data.code?.trim() || undefined,
    });

    // `signIn` with redirect:false returns `{ ok, error, url, status }`.
    // The `error` field is whatever `authorize()` threw — our
    // sentinel constants from `@/auth`.
    if (!result) {
      setBanner({
        kind: 'error',
        title: 'Erro inesperado',
        message: 'Não foi possível completar o login. Tente novamente.',
      });
      return;
    }

    if (result.error) {
      mapAuthorizeError(result.error);
      return;
    }

    // Happy path — the session is live. Figure out where to send
    // the user based on their primary role, honoring any callbackUrl
    // the middleware passed in.
    await redirectAfterLogin();
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
    // Pull the live session so we can read `mainRole` — NextAuth
    // writes the cookie synchronously, so a fresh `fetch` to the
    // session endpoint returns the just-created session.
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
    // We need a session to call /auth/email/send-verification, so
    // we sign in via credentials first (backend allows login for
    // unverified users) and then POST directly to auth-service.
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
    // Read the session to obtain the accessToken, then call the
    // auth-service through a relative `/api` proxy would be ideal
    // — but for now call it directly via the public URL.
    try {
      const sessionRes = await fetch('/api/auth/session', { cache: 'no-store' });
      const session = (await sessionRes.json()) as { accessToken?: string };
      if (!session.accessToken) throw new Error('no access token');
      const resend = await authServiceFetch<{ message: string }>(
        '/auth/email/send-verification',
        {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        },
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

  const isCredentialsPhase = phase === 'credentials';
  const loading = isSubmitting;
  const callbackUrl = safeCallback(searchParams.get('callbackUrl')) ?? undefined;

  return (
    <div className="space-y-6">
      {/* OAuth row — only on the credentials phase */}
      {isCredentialsPhase ? (
        <>
          <OAuthButtons callbackUrl={callbackUrl} disabled={loading} />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>
        </>
      ) : null}

      {/* Inline banners */}
      {banner.kind === 'error' ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="font-semibold">{banner.title}</p>
          <p className="mt-1 opacity-90">{banner.message}</p>
        </div>
      ) : null}

      {banner.kind === 'info' ? (
        <div
          role="status"
          className="rounded-md border border-primary/40 bg-primary/10 p-4 text-sm text-primary"
        >
          <p className="font-semibold">{banner.title}</p>
          <p className="mt-1 opacity-90">{banner.message}</p>
        </div>
      ) : null}

      {banner.kind === 'verify' ? (
        <div
          role="alert"
          className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200"
        >
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
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
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
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
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

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {phase === 'two-factor'
            ? loading
              ? 'Verificando…'
              : 'Verificar código'
            : loading
              ? 'Entrando…'
              : 'Entrar'}
        </Button>

        {phase === 'two-factor' ? (
          <button
            type="button"
            className="w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => {
              setPhase('credentials');
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
