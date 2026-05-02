import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { EmailModule } from './modules/email/email.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationModule } from './modules/notification/notification.module';
import { QueueModule } from './modules/queue/queue.module';
import { SubscriberModule } from './modules/subscriber/subscriber.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

/**
 * notification-service wiring.
 *
 * Pipeline:
 *   1. Any other service publishes an event to one of the Redis
 *      channels (e.g. "notifications:email", "notifications:inapp",
 *      "rh:vacation:approved", "finance:alerts").
 *   2. SubscriberModule's redis.subscriber listens on ALL relevant
 *      channels and drops a job on the "notifications" BullMQ queue.
 *   3. QueueModule's notification.consumer processes each job and
 *      dispatches to EmailModule (Resend) or NotificationModule
 *      (Prisma write + WebSocket push).
 *   4. NotificationGateway emits a `notification` event to the
 *      user's socket room — the frontend inbox lights up in real
 *      time if the user is currently connected.
 *
 * Single BullMQ queue on purpose — both email sends and in-app
 * writes go through the same retry/backoff policy so the ops
 * dashboard has one place to watch. If one channel starts
 * starving the other we can split them later without breaking
 * the wire format.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
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
    EmailModule,
    NotificationModule,
    QueueModule,
    SubscriberModule,
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
