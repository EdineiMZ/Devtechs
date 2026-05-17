import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import type { CurrentUserPayload } from '../decorators/current-user.decorator';
import { THROTTLERS } from './rate-limit.module';

interface RequestWithUser {
  user?: CurrentUserPayload;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * Extends the stock `@nestjs/throttler` guard with per-user tracking
 * for the `email-verification` bucket. Every other bucket falls back
 * to the default IP-based tracker.
 *
 * NOTE: `@nestjs/throttler@5.x` (what this repo pins today) has a
 * narrower public API than v6+, so more invasive customizations
 * (custom `handleRequest`, `throwThrottlingException` with detail
 * objects) aren't available on this version. The per-user tracker
 * override is the only customization we need for the spec.
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  /**
   * Decide the bucket key for a given request.
   *
   * - `email-verification`: keyed by authenticated user ID (3/hour per user).
   * - All other buckets: keyed by the real client IP.
   *
   * The auth-service sits behind a Next.js proxy that sets `x-real-ip`
   * to the browser's IP. We read that header first so throttle counters
   * track individual clients, not the shared web-container IP
   * (172.16.x.x) that would otherwise batch every user into one bucket.
   */
  protected override getTracker(
    req: Record<string, unknown>,
    throttlerName?: string,
  ): Promise<string> {
    if (throttlerName === THROTTLERS.EMAIL_VERIFICATION) {
      const user = (req as RequestWithUser).user;
      if (user?.id) return Promise.resolve(`user:${user.id}`);
    }
    const r = req as RequestWithUser;
    const realIp = r.headers?.['x-real-ip'];
    const clientIp = Array.isArray(realIp) ? realIp[0] : realIp;
    return Promise.resolve(clientIp ?? r.ip ?? 'unknown');
  }
}
