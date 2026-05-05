import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';

import {
  authServiceFetch,
  extractErrorMessage,
  type LoginResponseDto,
  type LoginSuccessDto,
} from '@/lib/auth-service';

/**
 * NextAuth v5 configuration for `apps/web`.
 *
 * Providers:
 *   - `credentials` → POST /auth/login (with optional 2FA TOTP via
 *     POST /auth/2fa/verify). 2FA is enforced before tokens are issued
 *     so `twoFactorCompleted` is always `true` for credentials sessions.
 *   - `email-otp` → POST /auth/email-otp/request + /verify. A
 *     passwordless OTP-per-email flow. The OTP acts as the second
 *     factor so `twoFactorCompleted` is also `true` here.
 *   - Google / GitHub OAuth → signIn callback forwards the profile to
 *     POST /auth/oauth/login. If the user has TOTP 2FA enabled,
 *     `twoFactorCompleted` is set to `false` and middleware will
 *     redirect them to /2fa-verificar before allowing /admin access.
 *
 * Session strategy: stateless JWT (no adapter). Custom fields are
 * carried in the cookie and NOT stored server-side.
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
    twoFactorEnabled: payload.user.twoFactorEnabled ?? false,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProvider = ReturnType<typeof Credentials> | any;

function buildProviders(): AnyProvider[] {
  const providers: AnyProvider[] = [
    // ------------------------------------------------------------------
    // Credentials: email + password (+ optional TOTP on 2FA accounts)
    // ------------------------------------------------------------------
    Credentials({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        email:     { label: 'Email',      type: 'email' },
        password:  { label: 'Senha',      type: 'password' },
        code:      { label: 'Código TOTP', type: 'text' },
        tempToken: { label: 'Temp Token', type: 'text' },
      },
      async authorize(credentials, request) {
        const clientIp =
          request?.headers?.get('x-real-ip') ??
          request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          undefined;
        const email     = String(credentials?.email     ?? '').trim().toLowerCase();
        const password  = String(credentials?.password  ?? '');
        const code      = credentials?.code      ? String(credentials.code)      : undefined;
        const tempToken = credentials?.tempToken ? String(credentials.tempToken) : undefined;

        if (!email || !password) {
          throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS);
        }

        // ── Fast path: tempToken + code → call /auth/2fa/verify directly ──
        // This is triggered from the login form's two-factor phase.
        // The tempToken was issued by the backend after password validation
        // so we don't need to re-verify the password here.
        if (tempToken && code) {
          const verify = await authServiceFetch<LoginSuccessDto>('/auth/2fa/verify', {
            body: { tempToken, code },
          });
          if (!verify.ok) {
            throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS);
          }
          return toAuthUser(verify.data as LoginSuccessDto);
        }

        // ── Normal path: POST /auth/login ──
        const login = await authServiceFetch<LoginResponseDto>('/auth/login', {
          body: { email, password },
          headers: clientIp ? { 'x-real-ip': clientIp } : undefined,
        });

        if (!login.ok) {
          const data = login.data as Record<string, unknown>;
          const errCode = typeof data.error === 'string' ? data.error : undefined;
          const message = extractErrorMessage(login.data);
          if (login.status === 429 || errCode === 'LoginBlocked') {
            throw new Error(AUTH_ERRORS.RATE_LIMITED);
          }
          if (/inactive|banned|banida/i.test(message)) {
            throw new Error(AUTH_ERRORS.ACCOUNT_BANNED);
          }
          throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS);
        }

        const loginData = login.data as LoginResponseDto;

        // If 2FA is required, signal that — the login form will call
        // preflightLogin() to get the tempToken, then re-submit via
        // the fast path above. NextAuth v5 normalises all thrown errors
        // to 'CredentialsSignin' so the form can't branch on this
        // string, but that's fine: the form uses preflightLogin() to
        // detect the 2FA requirement independently.
        if ('requires2FA' in loginData && loginData.requires2FA === true) {
          throw new Error(AUTH_ERRORS.TWO_FA_REQUIRED);
        }

        // ── Happy path: no 2FA required ──
        return toAuthUser(loginData as LoginSuccessDto);
      },
    }),

    // ------------------------------------------------------------------
    // Email OTP: passwordless login via a 6-digit code sent to the inbox
    // ------------------------------------------------------------------
    Credentials({
      id: 'email-otp',
      name: 'Email OTP',
      credentials: {
        email: { label: 'Email', type: 'email' },
        code: { label: 'Código', type: 'text' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').trim().toLowerCase();
        const code = String(credentials?.code ?? '').trim();

        if (!email || !code) {
          throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS);
        }

        const res = await authServiceFetch<LoginSuccessDto>('/auth/email-otp/verify', {
          body: { email, code },
        });

        if (!res.ok) {
          throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS);
        }

        return toAuthUser(res.data as LoginSuccessDto);
      },
    }),
  ];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        authorization: {
          params: { prompt: 'consent', access_type: 'offline', response_type: 'code' },
        },
      }),
    );
  }

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.push(
      GitHub({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      }),
    );
  }

  return providers;
}

export const {
  handlers,
  auth,
  signIn,
  signOut,
  unstable_update,
} = NextAuth({
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: buildProviders(),

  callbacks: {
    /**
     * Runs on every sign-in attempt. For OAuth we call the auth-service
     * "link or create" endpoint here, then mutate `user` so the `jwt`
     * callback below sees our backend fields.
     */
    async signIn({ user, account, profile }) {
      if (!account) return false;

      if (account.provider === 'credentials' || account.provider === 'email-otp') {
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
          body: { provider: account.provider, providerAccountId, email, name },
          headers: process.env.AUTH_INTERNAL_SECRET
            ? { 'x-internal-secret': process.env.AUTH_INTERNAL_SECRET }
            : undefined,
        });

        if (!res.ok) {
          return `/login?error=${AUTH_ERRORS.OAUTH_LINK_FAILED}`;
        }

        const enriched = toAuthUser(res.data as LoginSuccessDto);
        Object.assign(user, enriched);
        return true;
      }

      return false;
    },

    /**
     * Populates the JWT on first sign-in, refreshes access tokens
     * proactively, and handles mid-session 2FA completion updates.
     */
    async jwt({ token, user, account, trigger, session }) {
      // ---- First sign-in: populate token from user object ----
      if (user) {
        const u = user as typeof user & {
          id: string;
          roles: string[];
          mainRole: string | null;
          permissions: string[];
          emailVerified: boolean;
          twoFactorEnabled: boolean;
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
        token.twoFactorEnabled = Boolean(u.twoFactorEnabled);
        token.accessToken = u.accessToken;
        token.refreshToken = u.refreshToken;
        token.accessTokenExpiresAt = Date.now() + 14 * 60 * 1000;

        // OAuth users who have TOTP enabled have NOT yet completed 2FA
        // in this session — middleware will gate /admin and /developer
        // routes until they verify via /2fa-verificar.
        const isOAuth =
          account?.provider === 'google' || account?.provider === 'github';
        token.twoFactorCompleted = isOAuth ? !u.twoFactorEnabled : true;
      }

      // ---- Mid-session 2FA completion (unstable_update call) ----
      if (trigger === 'update' && (session as Record<string, unknown>)?.twoFactorCompleted !== undefined) {
        token.twoFactorCompleted = Boolean((session as Record<string, unknown>).twoFactorCompleted);
      }

      // ---- Proactive access token refresh ----
      if (token.accessTokenExpiresAt && Date.now() > (token.accessTokenExpiresAt as number)) {
        try {
          const res = await authServiceFetch<{ accessToken: string; refreshToken: string }>(
            '/auth/refresh',
            { body: { refreshToken: token.refreshToken } },
          );
          if (res.ok) {
            const refreshed = res.data as { accessToken: string; refreshToken: string };
            token.accessToken = refreshed.accessToken;
            token.refreshToken = refreshed.refreshToken;
            token.accessTokenExpiresAt = Date.now() + 14 * 60 * 1000;
          } else {
            token.accessToken = undefined as unknown as string;
            token.refreshToken = undefined as unknown as string;
            token.error = 'RefreshTokenExpired';
          }
        } catch {
          // Network error during refresh — keep stale token.
        }
      }

      return token;
    },

    /**
     * Exposes JWT fields to the client via `useSession()`.
     * Sensitive fields (refreshToken) stay in the JWT but are NOT
     * mirrored onto `session.user`.
     */
    async session({ session, token }) {
      if (!token) return session;

      if (token.error === 'RefreshTokenExpired') {
        return { ...session, user: undefined as unknown as typeof session.user };
      }

      const user = {
        id: token.id,
        name: token.name ?? null,
        email: token.email ?? null,
        image: (token.picture as string | null | undefined) ?? null,
        roles: token.roles ?? [],
        mainRole: token.mainRole ?? null,
        permissions: token.permissions ?? [],
        emailVerified: token.emailVerified ?? false,
        twoFactorEnabled: token.twoFactorEnabled ?? false,
      };
      session.user = user as unknown as typeof session.user;
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;
      session.twoFactorCompleted = token.twoFactorCompleted ?? true;
      return session;
    },
  },
});
