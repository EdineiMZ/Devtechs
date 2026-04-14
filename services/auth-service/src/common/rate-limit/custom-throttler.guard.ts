import { ExecutionContext, Injectable } from '@nestjs/common';
import {
  ThrottlerException,
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerRequest,
} from '@nestjs/throttler';
import type { Request, Response } from 'express';

import type { CurrentUserPayload } from '../decorators/current-user.decorator';
import { THROTTLERS } from './rate-limit.module';

interface RequestWithUser extends Request {
  user?: CurrentUserPayload;
}

/**
 * Extends the stock `@nestjs/throttler` guard with two behaviors the
 * auth-service needs:
 *
 *  1. **Per-user tracking for the `email-verification` bucket**.
 *     By default the throttler tracks by IP, but the spec wants
 *     `POST /auth/email/send-verification` limited to 3/hour *per user*.
 *     We override `getTracker()` so that bucket keys off `user:<id>`
 *     whenever the request is authenticated.
 *
 *  2. **`Retry-After` header on 429 responses.** The throttler sets
 *     `X-RateLimit-*` headers but not the canonical HTTP spec header,
 *     so we compute it from the `timeToExpire` field and attach it
 *     before re-throwing.
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  /**
   * Decide what key a given request is bucketed under, based on which
   * named throttler is being evaluated.
   */
  protected override async getTracker(
    req: Record<string, unknown>,
    throttlerName?: string,
  ): Promise<string> {
    // Per-user bucket for the email-verification throttler.
    if (throttlerName === THROTTLERS.EMAIL_VERIFICATION) {
      const user = (req as RequestWithUser).user;
      if (user?.id) return `user:${user.id}`;
    }
    // Fallback to IP for everything else (login, register, default).
    const ip = (req as { ip?: string }).ip;
    return ip ?? 'unknown';
  }

  /**
   * Called by the base guard when a limit is exceeded. We mirror its
   * behavior but attach a `Retry-After` header (in seconds) first so
   * well-behaved clients back off cleanly.
   */
  protected override async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const res = context.switchToHttp().getResponse<Response>();
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(throttlerLimitDetail.timeToExpire),
    );
    res.setHeader('Retry-After', String(retryAfterSeconds));
    throw new ThrottlerException(
      `Too many requests. Retry after ${retryAfterSeconds}s.`,
    );
  }

  /**
   * Small ergonomic tweak: the base implementation forwards the full
   * `ThrottlerRequest` to `handleRequest`. We keep it verbatim here so
   * the subclass stays a drop-in replacement; this stub exists solely
   * as a hook for future custom-logic without changing call sites.
   */
  protected override async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    return super.handleRequest(requestProps);
  }
}
