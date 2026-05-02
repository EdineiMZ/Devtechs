import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AuthLayout } from '@/components/auth/auth-layout';

import { ResendVerificationButton } from './resend-button';
import { SignOutLink } from './sign-out-link';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verifique seu email',
  robots: { index: false, follow: false },
};

/**
 * Landing page for a logged-in user whose email is still unverified.
 *
 * The middleware redirects any protected route (besides this page)
 * to `/verificar-email` as long as `session.user.emailVerified` is
 * `false`. Once the user clicks the link in the email the backend
 * flips the flag; the next JWT refresh (login/refresh) carries the
 * updated value and the middleware stops redirecting.
 *
 * Two small client islands sit below the static shell:
 *   - `ResendVerificationButton` posts to
 *     `/auth/email/send-verification` using the access token we
 *     pass down from the server session.
 *   - `SignOutLink` triggers NextAuth's sign-out so the user can
 *     log back in under a different email if they registered with
 *     the wrong address.
 */
export default async function VerificarEmailPage(): Promise<JSX.Element> {
  const session = await auth();

  // Defensive: the middleware is supposed to stop anonymous users
  // from ever landing here, but if it somehow misfires we bounce
  // the user to /login rather than rendering a broken page.
  if (!session?.user) {
    redirect('/login');
  }

  // If the user IS already verified, don't torture them with this
  // screen — send them to their role home.
  if (session.user.emailVerified) {
    redirect('/perfil');
  }

  const email = session.user.email ?? '';

  return (
    <AuthLayout
      title="Verifique seu email"
      description="Sua conta está quase pronta"
    >
      <div className="space-y-6">
        <div
          aria-hidden="true"
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/30"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7 text-primary"
          >
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>

        <div className="space-y-2 text-center">
          <p className="text-sm text-ash">
            Enviamos um link de verificação para
          </p>
          <p className="text-base font-semibold text-foreground">{email}</p>
        </div>

        <div className="rounded-md border border-white/8 bg-white/[0.02] p-4 text-xs text-ash">
          Clique no link dentro do email para ativar sua conta. Enquanto isso,
          o acesso aos recursos protegidos permanece bloqueado.
        </div>

        <ResendVerificationButton accessToken={session.accessToken} />

        <div className="text-center text-xs text-ash">
          Registrou o email errado? <SignOutLink />
        </div>
      </div>
    </AuthLayout>
  );
}
