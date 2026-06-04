import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './modules/health/health.module';
import { AdminModule } from './modules/admin/admin.module';
import { ApiV1Module } from './modules/api-v1/api-v1.module';

/**
 * Request pipeline:
 *
 *   - No global guards are registered here. Auth is applied per-controller
 *     for clarity with the dual-auth model:
 *
 *       - Public routes (GET /health): no guard
 *       - Public API routes (/v1/*): @UseGuards(ApiKeyGuard, RequireApiPermissionGuard)
 *       - Admin routes (/internal/api-keys/*): @UseGuards(JwtAdminGuard)
 *
 * ConfigModule is global so all services can inject ConfigService without
 * re-importing the module.
 *
 * PrismaModule and RedisModule are global (see their @Global() decorators)
 * so PrismaService and RedisService are available everywhere without
 * explicit imports.
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
    HealthModule,
    AdminModule,
    ApiV1Module,
  ],
})
export class AppModule {}
