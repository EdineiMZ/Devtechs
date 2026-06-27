import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

import { RedisModule } from '../../redis/redis.module';
import { RedisService } from '../../redis/redis.service';

/**
 * Named throttler identifiers. Using string constants (rather than
 * inline literals) keeps the controllers and the module config in lock-step.
 */
export const THROTTLERS = {
  DEFAULT: 'default',
  /** Used only by /auth/register. 10 requests per IP per hour. */
  REGISTER: 'register',
  /**
   * Used only by /auth/email/send-verification. 3 requests per userId
   * per hour — tracker is overridden in `CustomThrottlerGuard`.
   */
  EMAIL_VERIFICATION: 'email-verification',
  /**
   * Used by /auth/2fa/verify. 10 attempts per temp-token / IP pair per
   * 5 min so brute force of the 6-digit code within the validity window
   * is infeasible.
   */
  TWO_FA_VERIFY: '2fa-verify',
  /**
   * Used by /auth/forgot-password, /auth/reset-password/validate, and
   * /auth/reset-password. Limits are defined per-endpoint in the controller.
   */
  PASSWORD_RESET: 'password-reset',
} as const;

const isDev = (process.env.NODE_ENV ?? 'development') !== 'production';

/**
 * In development we relax every limit by ~100x so end-to-end tests
 * (which hammer `/auth/login` and friends) don't trip the counter.
 * Production keeps the original tight values.
 */
const devMultiplier = isDev ? 100 : 1;

const throttlers = [
  { name: THROTTLERS.DEFAULT, limit: 100 * devMultiplier, ttl: 60_000 },
  { name: THROTTLERS.REGISTER, limit: 10 * devMultiplier, ttl: 60 * 60_000 },
  { name: THROTTLERS.EMAIL_VERIFICATION, limit: 3 * devMultiplier, ttl: 60 * 60_000 },
  { name: THROTTLERS.TWO_FA_VERIFY, limit: 10 * devMultiplier, ttl: 5 * 60_000 },
  { name: THROTTLERS.PASSWORD_RESET, limit: 10 * devMultiplier, ttl: 60 * 60_000 },
];

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redisService: RedisService) => {
        if (isDev) {
          // In dev Redis may not be running; use in-memory so the service
          // boots cleanly. The 100x devMultiplier ensures tests don't trip
          // the limits anyway.
          return { throttlers };
        }

        // Production: Redis-backed storage so limits survive restarts and
        // are shared across all auth-service instances (fixes SZD-803).
        // We reuse the existing ioredis client from RedisService so there
        // is no second connection. ThrottlerStorageRedisService does NOT
        // call disconnect() on a client it didn't create.
        return {
          storage: new ThrottlerStorageRedisService(redisService.getClient()),
          throttlers,
        };
      },
    }),
  ],
  exports: [ThrottlerModule],
})
export class RateLimitModule {}
