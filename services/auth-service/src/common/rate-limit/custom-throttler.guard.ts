import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import type { CurrentUserPayload } from '../decorators/current-user.decorator';
import { THROTTLERS } from './rate-limit.module';

interface RequestWithUser {
  user?: CurrentUserPayload;
  ip?: string;
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
   * Decide the bucket key for a given request. For the
   * email-verification throttler we key on the authenticated user
   * so rate limits are per-user (3/hour). For every other bucket
   * we key on the IP, which is the default behavior.
   */
  protected override getTracker(
    req: Record<string, unknown>,
    throttlerName?: string,
  ): Promise<string> {
    if (throttlerName === THROTTLERS.EMAIL_VERIFICATION) {
      const user = (req as RequestWithUser).user;
      if (user?.id) return Promise.resolve(`user:${user.id}`);
    }
    const ip = (req as RequestWithUser).ip;
    return Promise.resolve(ip ?? 'unknown');
  }
}
