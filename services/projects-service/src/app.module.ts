import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';

import { AuthClientModule } from './auth-client/auth-client.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionResolverModule } from './common/permissions/permission-resolver.module';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { HealthModule } from './modules/health/health.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

/**
 * Request pipeline:
 *
 *   1. JwtAuthGuard (APP_GUARD) — validates the Bearer token and
 *      populates request.user with { id, email, sessionId }.
 *      Skipped on @Public() routes (only /health today).
 *
 *   2. PermissionGuard (per-controller via @UseGuards) — reads
 *      @RequirePermission(...), resolves effective permissions
 *      via the auth-service /auth/permissions/:userId endpoint
 *      with a 5-minute Redis cache.
 *
 * Wires the same six common modules every NestJS service in the
 * monorepo uses: ConfigModule, PrismaModule, RedisModule,
 * AuthClientModule, PermissionResolverModule, PassportModule.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
    RedisModule,
    AuthClientModule,
    PermissionResolverModule,
    ProjectsModule,
    TasksModule,
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
