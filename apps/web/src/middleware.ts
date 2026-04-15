import { NextResponse } from 'next/server';

import { auth } from '@/auth';

/**
 * Edge middleware — runs before every matched request.
 *
 * Responsibilities:
 *   1. Gate protected routes (`/perfil`, `/admin`, `/verificar-email`)
 *      behind authentication. Anonymous visitors get redirected to
 *      `/login?callbackUrl=<original-path>` so the post-login flow
 *      can bounce them back to where they were headed.
 *
 *   2. Enforce email verification on the core protected surface. A
 *      logged-in user whose email is not yet verified can still see
 *      `/verificar-email` (where they click the resend button) and
 *      the NextAuth sign-out route, but EVERY other protected path
 *      redirects them there so the product gates itself correctly.
 *
 *   3. Bounce already-authenticated users away from `/login` and
 *      `/register` so the auth pages aren't accessible mid-session.
 *
 * The middleware wraps `auth(...)` so `req.auth` is the decoded
 * session (or undefined when anonymous). `auth` uses the JWT
 * strategy so the check is purely cookie-based — no DB round-trip.
 */

const PROTECTED_PREFIXES = ['/perfil', '/admin', '/verificar-email'] as const;
const AUTH_PAGES = ['/login', '/register'] as const;

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

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const user = session?.user;

  // --------- Already authenticated → keep away from /login, /register ---
  if (user && isAuthPage(pathname)) {
    // If their email isn't verified, push them into the verification
    // flow instead of a random dashboard page.
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

  return NextResponse.next();
});

/**
 * Run the middleware on the auth pages and on every protected prefix,
 * but skip it on static assets and the NextAuth API route itself
 * (which would be a redirect loop).
 */
export const config = {
  matcher: [
    '/login',
    '/login/:path*',
    '/register',
    '/register/:path*',
    '/perfil',
    '/perfil/:path*',
    '/admin',
    '/admin/:path*',
    '/verificar-email',
    '/verificar-email/:path*',
  ],
};
