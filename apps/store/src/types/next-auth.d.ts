import 'next-auth';
import 'next-auth/jwt';

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
