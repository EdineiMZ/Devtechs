export interface LoginUserDto {
  id: string;
  name: string;
  email: string;
  roles: string[];
  primaryRole: string | null;
  emailVerified?: boolean;
  permissions?: string[];
}

export interface LoginSuccessDto {
  requires2FA: false;
  accessToken: string;
  refreshToken: string;
  user: LoginUserDto;
}

export interface TwoFactorRequiredDto {
  requires2FA: true;
  tempToken: string;
  tempTokenExpiresAt: string;
}

export type LoginResponseDto = LoginSuccessDto | TwoFactorRequiredDto;

export interface ErrorResponseDto {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

export function getAuthServiceUrl(): string {
  return (
    process.env.AUTH_SERVICE_URL ??
    process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ??
    'http://127.0.0.1:3001'
  );
}

export async function authServiceFetch<T>(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ ok: boolean; status: number; data: T | ErrorResponseDto }> {
  const res = await fetch(`${getAuthServiceUrl()}${path}`, {
    method: init.method ?? 'POST',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });

  let data: T | ErrorResponseDto;
  try {
    data = (await res.json()) as T | ErrorResponseDto;
  } catch {
    data = { statusCode: res.status, message: 'Resposta invalida do servidor' };
  }

  return { ok: res.ok, status: res.status, data };
}
