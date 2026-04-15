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
import { DeploymentsModule } from './modules/deployments/deployments.module';
import { EnvironmentsModule } from './modules/environments/environments.module';
import { GithubModule } from './modules/github/github.module';
import { HealthModule } from './modules/health/health.module';
import { HealthCheckModule } from './modules/jobs/health-check.module';
import { PipelinesModule } from './modules/pipelines/pipelines.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

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
    GithubModule,
    EnvironmentsModule,
    PipelinesModule,
    DeploymentsModule,
    HealthCheckModule,
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
