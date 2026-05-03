/**
 * Server-side helpers for talking to the `auth-service` NestJS API.
 *
 * Lives in `apps/web` rather than a shared package because the
 * auth-service's wire format is stable and small — duplicating the
 * contract here keeps the web app's deploy graph free of a NestJS
 * dependency chain that it wouldn't otherwise need.
 *
 * The base URL resolves from (in order):
 *   1. `AUTH_SERVICE_URL` — internal docker/nginx hostname, preferred
 *      in production (`http://auth-service:3001`).
 *   2. `NEXT_PUBLIC_AUTH_SERVICE_URL` — a public fallback, useful for
 *      local dev when NextAuth runs outside docker.
 *   3. `http://localhost:3001` — last-ditch default.
 */

export interface LoginUserDto {
  id: string;
  name: string;
  email: string;
  roles: string[];
  primaryRole: string | null;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
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

export interface RegisterResponseDto {
  message: string;
  userId: string;
}

export interface ErrorResponseDto {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

export function getAuthServiceUrl(): string {
  return (
    process.env.AUTH_SERVICE_URL ??
    process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ??
    'http://localhost:4001'
  );
}

/**
 * POST to an auth-service endpoint with JSON body + JSON parse.
 * Returns a structured result on both success and failure — never
 * throws — so callers can inspect `statusCode` and show targeted
 * errors without needing their own try/catch.
 */
export async function authServiceFetch<T>(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ ok: boolean; status: number; data: T | ErrorResponseDto }> {
  let res: Response;
  try {
    res = await fetch(`${getAuthServiceUrl()}${path}`, {
      method: init.method ?? 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      // Never cache auth calls — they're explicitly per-request.
      cache: 'no-store',
    });
  } catch {
    // Network-level failure (service unreachable, DNS error, etc.)
    return {
      ok: false,
      status: 503,
      data: {
        statusCode: 503,
        message:
          'Serviço de autenticação indisponível. Verifique sua conexão ou tente novamente em instantes.',
      },
    };
  }

  let data: T | ErrorResponseDto;
  try {
    data = (await res.json()) as T | ErrorResponseDto;
  } catch {
    data = { statusCode: res.status, message: 'Resposta inválida do servidor' };
  }

  return { ok: res.ok, status: res.status, data };
}

/**
 * Normalize an auth-service error response into a single string
 * suitable for displaying to the user. The NestJS global filter
 * returns `{ statusCode, message, error }`; class-validator errors
 * come through as an array of strings in `message`.
 */
export function extractErrorMessage(
  data: ErrorResponseDto | unknown,
  fallback = 'Ocorreu um erro inesperado',
): string {
  if (!data || typeof data !== 'object') return fallback;
  const body = data as ErrorResponseDto;
  const msg = body.message;
  if (Array.isArray(msg)) return msg[0] ?? fallback;
  if (typeof msg === 'string' && msg.length > 0) return msg;
  if (typeof body.error === 'string' && body.error.length > 0) return body.error;
  return fallback;
}
