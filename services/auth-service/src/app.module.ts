import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { CryptoModule } from './common/crypto/crypto.module';
import { CustomThrottlerGuard } from './common/rate-limit/custom-throttler.guard';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/auth.guard';
import { HealthModule } from './modules/health/health.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { RolesModule } from './modules/roles/roles.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

/**
 * Request pipeline (runs in this order):
 *
 *   1. CustomThrottlerGuard  — Redis-backed rate limits (global 100/min
 *      + named buckets for register, email-verification, 2fa-verify).
 *      Cheap Redis lookup, so blocked IPs never hit the DB.
 *
 *   2. JwtAuthGuard          — validates the access token and populates
 *      `request.user` for downstream guards / interceptors. Skipped on
 *      routes decorated with `@Public()`.
 *
 *   3. Per-route guards      — `EmailVerifiedGuard`, `TwoFactorGuard`,
 *      `RolesGuard`, `LoginRateLimitGuard`, etc.
 *
 *   4. AuditInterceptor      — captures audit entries for routes marked
 *      with `@Audit(...)`. Runs on the response-side `tap()` so the
 *      handler result (or error) is already known.
 *
 * Global guards provided via `APP_GUARD` execute in the order they are
 * listed in this providers array, so the throttler is registered BEFORE
 * the JWT guard deliberately.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    RedisModule,
    CryptoModule,
    RateLimitModule,
    AuditModule,
    AuthModule,
    RolesModule,
    PermissionsModule,
    HealthModule,
  ],
  providers: [
    // 1. Rate limiting — runs first so throttled IPs are stopped cheaply.
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    // 2. JWT auth — populates request.user for the rest of the pipeline.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global audit interceptor — opt-in via @Audit(...) on route handlers.
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
