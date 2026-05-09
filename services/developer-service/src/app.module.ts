import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthClientModule } from './auth-client/auth-client.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionResolverModule } from './common/permissions/permission-resolver.module';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { DeveloperConfigModule } from './modules/config/config.module';
import { DockerModule } from './modules/docker/docker.module';
import { HealthModule } from './modules/health/health.module';
import { MonitorModule } from './modules/monitor/monitor.module';
import { QueuesModule } from './modules/queues/queues.module';
import { ServicesModule } from './modules/services/services.module';
import { VpsModule } from './modules/vps/vps.module';
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
    PrismaModule,
    RedisModule,
    AuthClientModule,
    PermissionResolverModule,
    DockerModule,
    ServicesModule,
    MonitorModule,
    DeveloperConfigModule,
    QueuesModule,
    HealthModule,
    VpsModule,
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
