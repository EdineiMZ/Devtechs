import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import {
  authServiceFetch,
  type LoginResponseDto,
  type LoginSuccessDto,
  type TwoFactorRequiredDto,
} from '@/lib/auth-service';

function toAuthUser(payload: LoginSuccessDto) {
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
  pages: { signIn: '/login', error: '/login' },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
        code: { label: 'Codigo TOTP', type: 'text' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').trim().toLowerCase();
        const password = String(credentials?.password ?? '');
        const code = credentials?.code ? String(credentials.code) : undefined;

        if (!email || !password) throw new Error('INVALID_CREDENTIALS');

        const login = await authServiceFetch<LoginResponseDto>('/auth/login', {
          body: { email, password },
        });

        if (!login.ok) throw new Error('INVALID_CREDENTIALS');

        const loginData = login.data as LoginResponseDto;

        if ('requires2FA' in loginData && loginData.requires2FA === true) {
          const twoFa = loginData as TwoFactorRequiredDto;
          if (!code) throw new Error('2FA_REQUIRED');
          const verify = await authServiceFetch<LoginSuccessDto>('/auth/2fa/verify', {
            body: { tempToken: twoFa.tempToken, code },
          });
          if (!verify.ok) throw new Error('INVALID_CREDENTIALS');
          return toAuthUser(verify.data as LoginSuccessDto);
        }

        return toAuthUser(loginData as LoginSuccessDto);
      },
    }),
  ],

  callbacks: {
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

    async session({ session, token }) {
      if (!token) return session;
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
