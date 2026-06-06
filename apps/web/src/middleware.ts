import { NextResponse } from 'next/server';

import { auth } from '@/auth';

/**
 * Edge middleware — runs before every matched request.
 *
 * Responsibilities:
 *   1. Generate a per-request CSP nonce and set Content-Security-Policy.
 *   2. Gate protected routes behind authentication.
 *   3. Enforce email verification.
 *   4. Bounce authenticated users from /login and /register.
 *   5. Enforce TOTP 2FA on /admin and /developer routes for users who
 *      logged in via OAuth with twoFactorEnabled=true but haven't yet
 *      completed the mid-session 2FA challenge (/2fa-verificar).
 */

const PROTECTED_PREFIXES = ['/perfil', '/admin', '/developer', '/verificar-email'] as const;
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

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64');
}

function buildCsp(nonce: string): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: https:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
  ].join('; ');
}

function applyCsp(response: NextResponse, nonce: string): NextResponse {
  response.headers.set('Content-Security-Policy', buildCsp(nonce));
  response.headers.set('x-nonce', nonce);
  return response;
}

export default auth((req) => {
  const nonce = generateNonce();
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const user = session?.user;

  // --------- Already authenticated → keep away from /login, /register ---
  if (user && isAuthPage(pathname)) {
    const target = user.emailVerified ? '/perfil' : '/verificar-email';
    return applyCsp(NextResponse.redirect(new URL(target, req.nextUrl.origin)), nonce);
  }

  // --------- Anonymous → /login for protected routes -------------------
  if (!user && isProtected(pathname)) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return applyCsp(NextResponse.redirect(loginUrl), nonce);
  }

  // --------- Logged-in but unverified → /verificar-email ---------------
  if (user && !user.emailVerified && isProtected(pathname)) {
    if (pathname === '/verificar-email' || pathname.startsWith('/verificar-email/')) {
      return applyCsp(NextResponse.next(), nonce);
    }
    return applyCsp(NextResponse.redirect(new URL('/verificar-email', req.nextUrl.origin)), nonce);
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
      return applyCsp(NextResponse.next(), nonce);
    }
    const verifyUrl = new URL('/2fa-verificar', req.nextUrl.origin);
    verifyUrl.searchParams.set('callbackUrl', pathname);
    return applyCsp(NextResponse.redirect(verifyUrl), nonce);
  }

  // Pass nonce to Server Components via request header so layout.tsx can
  // read it with headers().get('x-nonce') for <script nonce> injection.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  return applyCsp(
    NextResponse.next({ request: { headers: requestHeaders } }),
    nonce,
  );
});

export const config = {
  matcher: [
    // All routes except Next.js internals and static assets.
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
};
