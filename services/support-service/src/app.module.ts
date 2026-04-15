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
import { ChatModule } from './modules/chat/chat.module';
import { HealthModule } from './modules/health/health.module';
import { SlaSweepModule } from './modules/jobs/sla-sweep.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

/**
 * Request pipeline mirrors projects-service / finance-service:
 *
 *   1. JwtAuthGuard (APP_GUARD) — validates the Bearer token,
 *      populates request.user with { id, email, sessionId }.
 *      Skipped on @Public() routes (only /health today).
 *
 *   2. PermissionGuard (per-controller via @UseGuards) — reads
 *      @RequirePermission(...), resolves effective permissions
 *      via auth-service with a 5-minute Redis cache.
 *
 *   3. ScheduleModule + BullMQ queue — drives the daily SLA-breach
 *      sweep (see SlaSweepModule).
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
        const url = config.get<string>('REDIS_URL');
        // Dev tolerance: lazyConnect + null retry strategy so a
        // missing Redis never crashes the service. The SLA sweep
        // scheduler catches enqueue failures and logs them as warns.
        const commonOptions = {
          maxRetriesPerRequest: devMode ? 1 : 3,
          lazyConnect: devMode,
          enableOfflineQueue: false,
          connectTimeout: devMode ? 2000 : 10_000,
          retryStrategy: devMode ? (): null => null : undefined,
        } as const;
        if (url) {
          return { connection: { ...commonOptions, url } };
        }
        return {
          connection: {
            ...commonOptions,
            host: config.get<string>('REDIS_HOST', 'redis'),
            port: Number(config.get<string>('REDIS_PORT', '6379')),
          },
        };
      },
    }),
    PrismaModule,
    RedisModule,
    AuthClientModule,
    PermissionResolverModule,
    TicketsModule,
    ChatModule,
    SlaSweepModule,
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
