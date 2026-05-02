import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuditAction } from '../constants/audit-actions';
import { AuditService } from '../../modules/audit/audit.service';
import { RedisService } from '../../redis/redis.service';

/** Count-window: how many attempts we track and over what period. */
const COUNT_WINDOW_SECONDS = 15 * 60; // 15 minutes
const isDev = (process.env.NODE_ENV ?? 'development') !== 'production';
const COUNT_THRESHOLD = isDev ? 5000 : 5;

/** Block-window: how long an IP is locked out once the threshold is hit. */
const BLOCK_DURATION_SECONDS = isDev ? 60 : 60 * 60; // 1 minute in dev, 1 hour in prod

const COUNT_KEY = (ip: string) => `rl:login:count:${ip}`;
const BLOCK_KEY = (ip: string) => `rl:login:block:${ip}`;

/**
 * Custom rate-limit guard for `POST /auth/login`.
 *
 * The standard `@nestjs/throttler` supports a rolling limit/TTL pair,
 * but this endpoint has asymmetric semantics the library doesn't
 * express natively: **5 attempts within 15 minutes triggers a 1-hour
 * lockout**. So we implement it directly on Redis:
 *
 *   1. Check for an existing lockout flag (`rl:login:block:<ip>`).
 *      If it exists, immediately 429 with `Retry-After = its TTL`.
 *
 *   2. Otherwise `INCR` a 15-min counter (`rl:login:count:<ip>`) and,
 *      on the first increment, attach a 15-min TTL.
 *
 *   3. If the new count >= 5, write the block flag with a 1-hour TTL,
 *      emit a `LOGIN_BLOCKED` audit record, and 429 the request.
 *
 * The guard runs BEFORE the controller's password check (guards run
 * ahead of handlers in NestJS), so a brute-force attempt never even
 * reaches the bcrypt step once blocked — the attack cost is kept
 * minimal on our side too.
 */
@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(LoginRateLimitGuard.name);

  constructor(
    private readonly redis: RedisService,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const ip = req.ip ?? 'unknown';

    // 1. Already blocked?
    const blocked = await this.redis.get(BLOCK_KEY(ip));
    if (blocked) {
      const ttl = await this.redis.ttl(BLOCK_KEY(ip));
      this.setRetryAfter(res, ttl);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'LoginBlocked',
          message: `Too many failed login attempts from this IP. Try again in ${Math.ceil(ttl / 60)} minutes.`,
          retryAfterSeconds: Math.max(1, ttl),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 2. Count this attempt within the rolling window.
    const count = await this.redis.incr(COUNT_KEY(ip));
    if (count === 1) {
      // First attempt in a fresh window — set the TTL so the counter
      // resets automatically if the user behaves.
      await this.redis.expire(COUNT_KEY(ip), COUNT_WINDOW_SECONDS);
    }

    // 3. Threshold hit: escalate to a 1h lockout.
    if (count >= COUNT_THRESHOLD) {
      await this.redis.setWithTTL(BLOCK_KEY(ip), '1', BLOCK_DURATION_SECONDS);
      // Zero out the counter so it restarts cleanly after the block expires.
      await this.redis.del(COUNT_KEY(ip));

      // Fire-and-forget audit write. Failures inside log() are
      // swallowed by the service so we never block the 429 response.
      void this.auditService.log({
        action: AuditAction.LOGIN_BLOCKED,
        module: 'AUTH',
        meta: {
          ip,
          windowSeconds: COUNT_WINDOW_SECONDS,
          threshold: COUNT_THRESHOLD,
          blockSeconds: BLOCK_DURATION_SECONDS,
          userAgent: req.headers['user-agent'] ?? null,
        },
        ipAddress: ip,
      });

      this.setRetryAfter(res, BLOCK_DURATION_SECONDS);
      this.logger.warn(
        `Login blocked for IP ${ip} after ${COUNT_THRESHOLD} attempts in ${COUNT_WINDOW_SECONDS}s`,
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'LoginBlocked',
          message: `Too many failed login attempts. This IP is blocked for ${BLOCK_DURATION_SECONDS / 60} minutes.`,
          retryAfterSeconds: BLOCK_DURATION_SECONDS,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private setRetryAfter(res: Response, seconds: number): void {
    res.setHeader('Retry-After', String(Math.max(1, seconds)));
  }
}
