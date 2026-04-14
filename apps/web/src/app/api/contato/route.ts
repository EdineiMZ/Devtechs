import { NextResponse } from 'next/server';

import {
  CONTACT_SUBJECT_LABELS,
  contactSchema,
} from '@/lib/contato-schema';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRedisClient } from '@/lib/redis';

/**
 * POST /api/contato — contact-form submission endpoint.
 *
 * Pipeline:
 *   1. Extract the caller IP from proxy headers (Next doesn't expose
 *      `request.ip` in App Router handlers, so we read the standard
 *      `x-forwarded-for` / `x-real-ip` chain ourselves).
 *   2. Rate limit: 3 submissions per IP per hour. Over-quota callers
 *      get a 429 with a `Retry-After` header in seconds.
 *   3. Parse + zod-validate the JSON body using the same schema the
 *      client form imports, so any mismatch between client and server
 *      is a zod error on our side and a hint that the client bundle
 *      got stale.
 *   4. Publish two events to Redis `notifications:email`:
 *        - one to `contato@devtechs.com.br` for the ops inbox
 *        - one to the user's own email as a confirmation receipt
 *      Both go through the same channel notification-service listens on.
 *   5. Return `{ success: true }` on the happy path, or a structured
 *      error body with the appropriate HTTP status otherwise.
 *
 * Runs on the Node runtime because ioredis uses `net` sockets that
 * the Edge runtime doesn't support.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60; // 1 hour
const OPS_EMAIL = 'contato@devtechs.com.br';

const EVENT_CHANNEL = 'notifications:email';
const TEMPLATE_OPS = 'contact-form';
const TEMPLATE_CONFIRMATION = 'contact-confirmation';

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);

  // ---------------------------------------------------------------
  // 1. Rate limit
  // ---------------------------------------------------------------
  let rateLimit;
  try {
    rateLimit = await checkRateLimit(
      `rl:contato:${ip}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_SECONDS,
    );
  } catch (err) {
    // Redis down: fail OPEN for the rate limiter so a transient cache
    // outage doesn't block legitimate users. The publish step below
    // will surface the real problem as a 500 if Redis is truly dead.
    // eslint-disable-next-line no-console
    console.error('[contato] rate-limit check failed:', err);
    rateLimit = { allowed: true, retryAfterSeconds: 0, remaining: RATE_LIMIT_MAX, count: 0 };
  }

  if (!rateLimit.allowed) {
    const minutes = Math.ceil(rateLimit.retryAfterSeconds / 60);
    return NextResponse.json(
      {
        success: false,
        error: 'RateLimitExceeded',
        message: `Você enviou muitas mensagens recentemente. Tente novamente em ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  // ---------------------------------------------------------------
  // 2. Parse JSON
  // ---------------------------------------------------------------
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'InvalidPayload',
        message: 'Corpo da requisição inválido. Envie um JSON válido.',
      },
      { status: 400 },
    );
  }

  // ---------------------------------------------------------------
  // 3. Validate with the shared schema
  // ---------------------------------------------------------------
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'ValidationError',
        message: 'Dados do formulário inválidos. Confira os campos destacados.',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const subjectLabel = CONTACT_SUBJECT_LABELS[data.assunto];
  const submittedAt = new Date().toISOString();

  // ---------------------------------------------------------------
  // 4. Publish both events to Redis
  // ---------------------------------------------------------------
  try {
    const redis = getRedisClient();

    const opsMessage = buildEvent({
      to: OPS_EMAIL,
      subject: `Novo contato: ${subjectLabel}`,
      template: TEMPLATE_OPS,
      data: {
        nome: data.nome,
        email: data.email,
        telefone: data.telefone ?? null,
        assunto: subjectLabel,
        assuntoKey: data.assunto,
        mensagem: data.mensagem,
        ipAddress: ip,
        submittedAt,
      },
    });

    const confirmationMessage = buildEvent({
      to: data.email,
      subject: 'Recebemos sua mensagem — DevTechs',
      template: TEMPLATE_CONFIRMATION,
      data: {
        nome: data.nome,
        assunto: subjectLabel,
        submittedAt,
      },
    });

    await Promise.all([
      redis.publish(EVENT_CHANNEL, opsMessage),
      redis.publish(EVENT_CHANNEL, confirmationMessage),
    ]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[contato] failed to publish events:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'InternalError',
        message:
          'Não foi possível enviar sua mensagem agora. Tente novamente em instantes.',
      },
      { status: 500 },
    );
  }

  // ---------------------------------------------------------------
  // 5. Happy path
  // ---------------------------------------------------------------
  return NextResponse.json({
    success: true,
    message: 'Mensagem enviada com sucesso! Em breve entraremos em contato.',
  });
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

interface EventInput {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

/**
 * Wrap an email payload in the envelope shape the notification-service
 * subscriber expects. Matching the format published by auth-service so
 * both producers look identical on the wire.
 */
function buildEvent(payload: EventInput): string {
  return JSON.stringify({
    channel: EVENT_CHANNEL,
    publishedAt: new Date().toISOString(),
    payload,
  });
}

/**
 * Extract the client IP from proxy headers. Prefers `x-forwarded-for`
 * (standard; takes the first entry in the comma-separated chain),
 * falls back to `x-real-ip`, then to `'unknown'`. Used both for rate
 * limiting and for the ops-inbox audit trail.
 */
function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0];
    if (first && first.trim()) return first.trim();
  }
  const real = request.headers.get('x-real-ip');
  if (real && real.trim()) return real.trim();
  return 'unknown';
}
