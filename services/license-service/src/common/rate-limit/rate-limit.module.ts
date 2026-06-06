import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

/**
 * Named throttler buckets.
 * - 'verify': public /tokens/verify endpoint — 30 req/min per IP to mitigate brute-force.
 * - 'default': all other authenticated endpoints — 120 req/min per IP.
 */
export const THROTTLERS = {
  DEFAULT: 'default',
  VERIFY: 'verify',
} as const;

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: THROTTLERS.DEFAULT,
        ttl: 60_000,
        limit: 120,
      },
      {
        name: THROTTLERS.VERIFY,
        ttl: 60_000,
        limit: 30,
      },
    ]),
  ],
  exports: [ThrottlerModule],
})
export class RateLimitModule {}
