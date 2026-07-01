import { NextResponse } from 'next/server';

import { auth } from '@/auth';

/**
 * Edge middleware — runs before every matched request.
 *
 * Responsibilities:
 *   1. Gate protected routes behind authentication.
 *   2. Enforce email verification.
 *   3. Bounce authenticated users from /login and /register.
 *   4. Enforce TOTP 2FA on /admin and /developer routes for users who
 *      logged in via OAuth with twoFactorEnabled=true but haven't yet
 *      completed the mid-session 2FA challenge (/2fa-verificar).
 */

const PROTECTED_PREFIXES = ['/perfil', '/dashboard', '/admin', '/developer', '/verificar-email'] as const;
const AUTH_PAGES = ['/login', '/register'] as const;
/** Routes that require 2FA completion when twoFactorEnabled=true. */
const TWO_FA_GATED_PREFIXES = ['/admin', '/developer'] as const;

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isTwoFaGated(pathname: string): boolean {
  return TWO_FA_GATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const user = session?.user;

  // --------- Already authenticated → keep away from /login, /register ---
  if (user && isAuthPage(pathname)) {
    const target = user.emailVerified ? '/perfil' : '/verificar-email';
    return NextResponse.redirect(new URL(target, req.nextUrl.origin));
  }

  // --------- Anonymous → /login for protected routes -------------------
  if (!user && isProtected(pathname)) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // --------- Logged-in but unverified → /verificar-email ---------------
  if (user && !user.emailVerified && isProtected(pathname)) {
    if (pathname === '/verificar-email' || pathname.startsWith('/verificar-email/')) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/verificar-email', req.nextUrl.origin));
  }

  // --------- Logged-in but 2FA not completed → /2fa-verificar ----------
  // Only for /admin and /developer routes when the user has TOTP enabled
  // but hasn't verified it in this session (e.g., logged in via OAuth).
  if (
    user &&
    user.emailVerified &&
    isTwoFaGated(pathname) &&
    user.twoFactorEnabled &&
    !(session as unknown as Record<string, unknown>)?.twoFactorCompleted
  ) {
    if (pathname === '/2fa-verificar' || pathname.startsWith('/2fa-verificar/')) {
      return NextResponse.next();
    }
    const verifyUrl = new URL('/2fa-verificar', req.nextUrl.origin);
    verifyUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(verifyUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/login',
    '/login/:path*',
    '/register',
    '/register/:path*',
    '/perfil',
    '/perfil/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/admin',
    '/admin/:path*',
    '/developer',
    '/developer/:path*',
    '/verificar-email',
    '/verificar-email/:path*',
    '/2fa-verificar',
    '/2fa-verificar/:path*',
  ],
};
