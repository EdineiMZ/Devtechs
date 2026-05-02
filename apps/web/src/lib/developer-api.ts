import { auth } from '@/auth';

/**
 * Server-side fetch wrapper for the developer-service.
 *
 * Reads the user's access token from the NextAuth session and
 * attaches it as a Bearer header. `cache: 'no-store'` is mandatory
 * because everything the developer panel surfaces (containers,
 * queues, config) is per-instance live state — never cacheable.
 */
export function getDeveloperServiceUrl(): string {
  return (
    process.env.DEVELOPER_SERVICE_URL ??
    process.env.NEXT_PUBLIC_DEVELOPER_SERVICE_URL ??
    process.env.NEXT_PUBLIC_DEVELOPER_URL ??
    'http://127.0.0.1:4010'
  );
}

interface FetchOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  accessToken?: string;
}

export async function devFetch<T>(
  path: string,
  opts: FetchOptions = {},
): Promise<{
  ok: boolean;
  status: number;
  data: T | { message?: string };
}> {
  let token = opts.accessToken;
  if (!token) {
    const session = await auth();
    token = session?.accessToken;
  }

  const params = opts.query
    ? '?' +
      Object.entries(opts.query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(
          ([k, v]) =>
            `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
        )
        .join('&')
    : '';

  const url = `${getDeveloperServiceUrl()}${path}${params}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: 503, data: { message: 'developer-service indisponível' } };
  }

  let data: T | { message?: string };
  try {
    data = (await res.json()) as T;
  } catch {
    data = { message: 'Resposta invalida' };
  }
  return { ok: res.ok, status: res.status, data };
}
