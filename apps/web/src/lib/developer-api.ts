import { auth } from '@/auth';

/**
 * Server-side fetch wrapper for the developer-service.
 *
 * Reads the user's access token from the NextAuth session and
 * attaches it as a Bearer header. `cache: 'no-store'` is mandatory
 * because everything the developer panel surfaces (containers,
 * queues, config) is per-instance live state — never cacheable.
 *
 * SERVER-ONLY: this resolves to the internal docker network address
 * (`http://developer-service:3010`) which is unreachable from the
 * browser. Do NOT pass the result of this function down as a prop to
 * a client component — use `getDeveloperWsTarget()` for browser-side
 * websockets instead.
 */
export function getDeveloperServiceUrl(): string {
  return (
    process.env.DEVELOPER_SERVICE_URL ??
    process.env.NEXT_PUBLIC_DEVELOPER_SERVICE_URL ??
    process.env.NEXT_PUBLIC_DEVELOPER_URL ??
    'http://127.0.0.1:4010'
  );
}

/**
 * Browser-side socket.io target for the developer-service `/monitor`
 * gateway. Returns a same-origin path-only URL so the protocol is
 * inherited from `window.location` (HTTPS → wss, HTTP → ws). nginx
 * forwards `/api/developer/socket.io/` to `developer-service:3010`.
 *
 * An explicit dev-only override (e.g. `http://localhost:4010` pointing
 * straight at the service) is honored as long as it does not embed an
 * `/api/` prefix — `NEXT_PUBLIC_DEVELOPER_URL=https://szdevs.com/api/developer`
 * is the REST gateway, not a websocket endpoint, so we ignore it.
 */
export function getDeveloperWsTarget(): { url: string; path: string } {
  const override =
    process.env.NEXT_PUBLIC_DEVELOPER_SERVICE_URL ??
    process.env.NEXT_PUBLIC_DEVELOPER_URL;
  if (
    override &&
    !override.includes('/api/') &&
    (override.startsWith('http://') || override.startsWith('https://'))
  ) {
    return { url: `${override}/monitor`, path: '/socket.io/' };
  }
  return { url: '/monitor', path: '/api/developer/socket.io/' };
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
