import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthClientModule } from './auth-client/auth-client.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionResolverModule } from './common/permissions/permission-resolver.module';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { CostCentersModule } from './modules/cost-centers/cost-centers.module';
import { HealthModule } from './modules/health/health.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { OverdueSweepModule } from './modules/jobs/overdue-sweep.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

/**
 * Request pipeline mirrors projects-service / rh-service:
 *
 *   1. JwtAuthGuard (APP_GUARD) — validates the Bearer token,
 *      populates request.user with { id, email, sessionId }.
 *      Skipped on @Public() routes (only /health today).
 *
 *   2. PermissionGuard (per-controller via @UseGuards) — reads
 *      @RequirePermission(...), resolves effective permissions
 *      via auth-service with a 5-minute Redis cache.
 *
 * Extras over the other services:
 *   - BullModule for the finance-jobs queue (used by the OVERDUE
 *     daily sweep).
 *   - ScheduleModule for the @Cron trigger that enqueues the sweep.
 *
 * BullMQ uses the same Redis instance as the permission cache but
 * namespaces its keys with its own prefix, so cache reads and job
 * queues never collide.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const devMode = (process.env.NODE_ENV ?? 'development') !== 'production';
        const tolerance = devMode
          ? {
              maxRetriesPerRequest: 1,
              connectTimeout: 2000,
              lazyConnect: true,
              enableOfflineQueue: false,
              retryStrategy: (): null => null,
            }
          : {};
        const url = config.get<string>('REDIS_URL');
        if (url) {
          return { connection: { url, ...tolerance } };
        }
        return {
          connection: {
            host: config.get<string>('REDIS_HOST', 'redis'),
            port: Number(config.get<string>('REDIS_PORT', '6379')),
            ...tolerance,
          },
        };
      },
    }),
    PrismaModule,
    RedisModule,
    AuthClientModule,
    PermissionResolverModule,
    TransactionsModule,
    CostCentersModule,
    InvoicesModule,
    OverdueSweepModule,
    HealthModule,
  ],
  providers: [
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
