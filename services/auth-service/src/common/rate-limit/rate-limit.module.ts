import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

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

/**
 * NOTE: the original design used `@nest-lab/throttler-storage-redis` for
 * a shared Redis-backed counter, but the storage adapter's public
 * interface changed between throttler v5 and v6 — the adapter today
 * implements the v6 shape, while this repo pins `@nestjs/throttler@5.x`.
 * To keep the service compilable without upgrading the throttler (a
 * separate, larger change), we fall back to the throttler's built-in
 * in-memory counter. It still enforces limits per-process; the only
 * loss is cross-instance sharing, which isn't meaningful for a single
 * dev auth-service. A follow-up turn should upgrade throttler to v6+
 * and restore the Redis storage.
 */
/**
 * In development we relax every limit by ~100x so end-to-end tests
 * (which hammer `/auth/login` and friends) don't trip the in-memory
 * counter. Production keeps the original tight values.
 */
const isDev = (process.env.NODE_ENV ?? 'development') !== 'production';
const devMultiplier = isDev ? 100 : 1;

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: THROTTLERS.DEFAULT, limit: 100 * devMultiplier, ttl: 60_000 },
      { name: THROTTLERS.REGISTER, limit: 10 * devMultiplier, ttl: 60 * 60_000 },
      { name: THROTTLERS.EMAIL_VERIFICATION, limit: 3 * devMultiplier, ttl: 60 * 60_000 },
      { name: THROTTLERS.TWO_FA_VERIFY, limit: 10 * devMultiplier, ttl: 5 * 60_000 },
      { name: THROTTLERS.PASSWORD_RESET, limit: 10 * devMultiplier, ttl: 60 * 60_000 },
    ]),
  ],
  exports: [ThrottlerModule],
})
export class RateLimitModule {}
