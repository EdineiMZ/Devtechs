import 'next-auth';
import 'next-auth/jwt';

/**
 * Module augmentation for `next-auth`.
 *
 * NextAuth's default `User` / `Session` shapes only carry `name`,
 * `email`, `image`. Our app needs the full backend payload â€” roles,
 * primary role, permissions, email-verification flag, and the
 * auth-service access + refresh tokens so calls to /auth/email/* etc.
 * can piggy-back on the existing session.
 *
 * Keep these shapes in lock-step with the fields populated inside
 * `jwt` and `session` callbacks in `auth.ts`. TypeScript uses the
 * declarations here when narrowing `req.auth`, `session.user`, and
 * the JWT object passed to callbacks.
 */

interface SZDevsAuthFields {
  id: string;
  roles: string[];
  mainRole: string | null;
  permissions: string[];
  emailVerified: boolean;
  /** Whether the user has TOTP 2FA enabled on their account. */
  twoFactorEnabled: boolean;
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
      twoFactorEnabled: boolean;
    };
    accessToken: string;
    refreshToken: string;
    /** Set when the 2FA session check has been completed mid-session. */
    twoFactorCompleted: boolean;
    error?: 'RefreshAccessTokenError';
  }

  interface User extends SZDevsAuthFields {
    name: string | null;
    email: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends SZDevsAuthFields {
    name?: string | null;
    email?: string | null;
    picture?: string | null;
    /**
     * Whether the user completed 2FA in this session. Computed in the `jwt`
     * callback: always true for credentials/email-otp; false for OAuth users
     * with twoFactorEnabled who haven't yet visited /2fa-verificar.
     */
    twoFactorCompleted?: boolean;
  }
}
