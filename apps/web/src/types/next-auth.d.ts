import 'next-auth';
import 'next-auth/jwt';

/**
 * Module augmentation for `next-auth`.
 *
 * NextAuth's default `User` / `Session` shapes only carry `name`,
 * `email`, `image`. Our app needs the full backend payload — roles,
 * primary role, permissions, email-verification flag, and the
 * auth-service access + refresh tokens so calls to /auth/email/* etc.
 * can piggy-back on the existing session.
 *
 * Keep these shapes in lock-step with the fields populated inside
 * `jwt` and `session` callbacks in `auth.ts`. TypeScript uses the
 * declarations here when narrowing `req.auth`, `session.user`, and
 * the JWT object passed to callbacks.
 */

interface DevTechsAuthFields {
  id: string;
  roles: string[];
  mainRole: string | null;
  permissions: string[];
  emailVerified: boolean;
  accessToken: string;
  refreshToken: string;
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image?: string | null;
      roles: string[];
      mainRole: string | null;
      permissions: string[];
      emailVerified: boolean;
    };
    accessToken: string;
    refreshToken: string;
    error?: 'RefreshAccessTokenError';
  }

  interface User extends DevTechsAuthFields {
    name: string | null;
    email: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DevTechsAuthFields {
    name?: string | null;
    email?: string | null;
    picture?: string | null;
  }
}
