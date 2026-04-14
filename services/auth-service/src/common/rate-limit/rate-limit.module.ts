import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';

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
} as const;

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        const host = config.get<string>('REDIS_HOST', 'redis');
        const port = Number(config.get<string>('REDIS_PORT', '6379'));

        const redis = url
          ? new Redis(url, { maxRetriesPerRequest: 3 })
          : new Redis({ host, port, maxRetriesPerRequest: 3 });

        return {
          throttlers: [
            {
              name: THROTTLERS.DEFAULT,
              limit: 100,
              ttl: 60_000, // 1 minute
            },
            {
              name: THROTTLERS.REGISTER,
              limit: 10,
              ttl: 60 * 60_000, // 1 hour
            },
            {
              name: THROTTLERS.EMAIL_VERIFICATION,
              limit: 3,
              ttl: 60 * 60_000, // 1 hour
            },
            {
              name: THROTTLERS.TWO_FA_VERIFY,
              limit: 10,
              ttl: 5 * 60_000, // 5 minutes
            },
          ],
          storage: new ThrottlerStorageRedisService(redis),
        };
      },
    }),
  ],
  exports: [ThrottlerModule],
})
export class RateLimitModule {}
