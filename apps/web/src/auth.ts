import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';

import {
  authServiceFetch,
  extractErrorMessage,
  type LoginResponseDto,
  type LoginSuccessDto,
  type TwoFactorRequiredDto,
} from '@/lib/auth-service';

/**
 * NextAuth v5 configuration for `apps/web`.
 *
 * Three providers:
 *   - Credentials → POST /auth/login on auth-service (with optional
 *     2FA re-verify via POST /auth/2fa/verify in the same call).
 *   - Google OAuth2 → NextAuth handles the OAuth dance; the
 *     `signIn` callback forwards the verified profile to the
 *     auth-service `POST /auth/oauth/login` endpoint, which finds
 *     or creates a user, links the OAuth account, and returns the
 *     same session payload the Credentials flow produces.
 *   - GitHub OAuth2 → same shape as Google.
 *
 * Session strategy is JWT (stateless) because the app has no server
 * database for NextAuth's adapter — user records live in auth-service
 * behind Prisma. The JWT carries enough state (roles, mainRole,
 * permissions, emailVerified, accessToken, refreshToken) that the
 * middleware can route on role and the client can hit protected
 * auth-service endpoints without a second login.
 *
 * Error mapping from the Credentials `authorize` function uses
 * sentinel messages that the client form branches on:
 *   - `2FA_REQUIRED` → show the TOTP code input
 *   - `EMAIL_NOT_VERIFIED` → show the resend-verification banner
 *   - `ACCOUNT_BANNED` → show the banned-account notice
 *   - any other string → generic invalid-credentials notice
 */

/** Frontend-facing error codes the login form branches on. */
export const AUTH_ERRORS = {
  TWO_FA_REQUIRED: '2FA_REQUIRED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_BANNED: 'ACCOUNT_BANNED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  OAUTH_LINK_FAILED: 'OAUTH_LINK_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

type LoginSuccess = LoginSuccessDto;

/**
 * Map an auth-service login response into the shape NextAuth's
 * `authorize` / `signIn` callbacks want to return.
 */
function toAuthUser(payload: LoginSuccess) {
  return {
    id: payload.user.id,
    name: payload.user.name ?? null,
    email: payload.user.email ?? null,
    roles: payload.user.roles ?? [],
    mainRole: payload.user.primaryRole ?? null,
    permissions: payload.user.permissions ?? [],
    emailVerified: payload.user.emailVerified ?? false,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
  };
}

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
        code: { label: 'Código TOTP', type: 'text' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').trim().toLowerCase();
        const password = String(credentials?.password ?? '');
        const code = credentials?.code ? String(credentials.code) : undefined;

        if (!email || !password) {
          throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS);
        }

        // ---- Step 1: POST /auth/login ----
        const login = await authServiceFetch<LoginResponseDto>('/auth/login', {
          body: { email, password },
        });

        if (!login.ok) {
          const data = login.data as Record<string, unknown>;
          const errCode = typeof data.error === 'string' ? data.error : undefined;
          const message = extractErrorMessage(login.data);
          // Surface specific backend errors so the form can branch.
          if (login.status === 429 || errCode === 'LoginBlocked') {
            throw new Error(AUTH_ERRORS.RATE_LIMITED);
          }
          if (/inactive|banned|banida/i.test(message)) {
            throw new Error(AUTH_ERRORS.ACCOUNT_BANNED);
          }
          throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS);
        }

        const loginData = login.data as LoginResponseDto;

        // ---- Step 2 (only if 2FA enabled): /auth/2fa/verify ----
        if ('requires2FA' in loginData && loginData.requires2FA === true) {
          const twoFa = loginData as TwoFactorRequiredDto;
          if (!code) {
            // Client hasn't submitted the TOTP yet — signal so the
            // login form knows to reveal the code field.
            throw new Error(AUTH_ERRORS.TWO_FA_REQUIRED);
          }
          const verify = await authServiceFetch<LoginSuccessDto>('/auth/2fa/verify', {
            body: { tempToken: twoFa.tempToken, code },
          });
          if (!verify.ok) {
            throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS);
          }
          return toAuthUser(verify.data as LoginSuccessDto);
        }

        // ---- Happy path: no 2FA required ----
        return toAuthUser(loginData as LoginSuccessDto);
      },
    }),

    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: { prompt: 'consent', access_type: 'offline', response_type: 'code' },
      },
    }),

    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  ],

  callbacks: {
    /**
     * Runs on every sign-in attempt, AFTER `authorize()` for
     * Credentials or AFTER the OAuth provider returns a profile.
     * For OAuth we call the auth-service "link or create" endpoint
     * here, then mutate the passed-in `user` object so the `jwt`
     * callback below sees our real backend fields.
     */
    async signIn({ user, account, profile }) {
      if (!account) return false;

      if (account.provider === 'credentials') {
        // Credentials sign-in already produced a fully-populated user
        // in `authorize()`. Nothing else to do.
        return true;
      }

      if (account.provider === 'google' || account.provider === 'github') {
        const email = user.email ?? (profile as { email?: string } | undefined)?.email ?? null;
        const name =
          user.name ?? (profile as { name?: string } | undefined)?.name ?? null;
        const providerAccountId = account.providerAccountId;
        if (!email || !providerAccountId) {
          return `/login?error=${AUTH_ERRORS.OAUTH_LINK_FAILED}`;
        }

        const res = await authServiceFetch<LoginSuccessDto>('/auth/oauth/login', {
          body: {
            provider: account.provider,
            providerAccountId,
            email,
            name,
          },
          headers: process.env.AUTH_INTERNAL_SECRET
            ? { 'x-internal-secret': process.env.AUTH_INTERNAL_SECRET }
            : undefined,
        });

        if (!res.ok) {
          // Block OAuth login entirely if the link/create call failed.
          // Redirect back to /login with an error code the form maps
          // to a friendly message.
          return `/login?error=${AUTH_ERRORS.OAUTH_LINK_FAILED}`;
        }

        // Splice the backend fields onto the existing `user` object.
        // NextAuth will then hand this object to the `jwt` callback
        // which copies everything into the JWT.
        const enriched = toAuthUser(res.data as LoginSuccessDto);
        Object.assign(user, enriched);
        return true;
      }

      return false;
    },

    /**
     * Populates the JWT with our custom fields on the first
     * sign-in. On subsequent calls (when NextAuth just refreshes
     * the token for the same session) the fields are already
     * present and we pass through.
     */
    async jwt({ token, user }) {
      if (user) {
        const u = user as typeof user & {
          id: string;
          roles: string[];
          mainRole: string | null;
          permissions: string[];
          emailVerified: boolean;
          accessToken: string;
          refreshToken: string;
        };
        token.id = u.id ?? token.id ?? '';
        token.name = u.name ?? null;
        token.email = u.email ?? null;
        token.roles = u.roles ?? [];
        token.mainRole = u.mainRole ?? null;
        token.permissions = u.permissions ?? [];
        token.emailVerified = Boolean(u.emailVerified);
        token.accessToken = u.accessToken;
        token.refreshToken = u.refreshToken;
      }
      return token;
    },

    /**
     * Exposes the JWT fields to the client via `useSession()`.
     * Sensitive fields (refreshToken) stay in the JWT but are
     * NOT mirrored onto `session.user` so the React tree can't
     * accidentally leak them to analytics or third-party scripts.
     */
    async session({ session, token }) {
      if (!token) return session;
      // NextAuth v5 beta typed `session.user` as `AdapterUser` which
      // requires `email: string`. Our schema permits null emails on
      // OAuth-linked accounts that haven't surfaced their address
      // yet, so we go through `unknown` to bypass the check — the
      // runtime contract still matches our own `Session` augmentation
      // in `types/next-auth.d.ts`.
      const user = {
        id: token.id,
        name: token.name ?? null,
        email: token.email ?? null,
        image: (token.picture as string | null | undefined) ?? null,
        roles: token.roles ?? [],
        mainRole: token.mainRole ?? null,
        permissions: token.permissions ?? [],
        emailVerified: token.emailVerified ?? false,
      };
      session.user = user as unknown as typeof session.user;
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;
      return session;
    },
  },
});
