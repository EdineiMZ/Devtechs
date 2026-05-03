import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { StorageModule } from '@szdevs/storage';

import { AuthClientModule } from './auth-client/auth-client.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionResolverModule } from './common/permissions/permission-resolver.module';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { DepartmentsModule } from './modules/departments/departments.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { HealthModule } from './modules/health/health.module';
import { PositionsModule } from './modules/positions/positions.module';
import { VacationsModule } from './modules/vacations/vacations.module';
import { WorkSchedulesModule } from './modules/work-schedules/work-schedules.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

/**
 * Request pipeline:
 *
 *   1. `JwtAuthGuard` (APP_GUARD) â€” validates the Bearer token,
 *      populates `request.user`. Skipped on routes with `@Public()`
 *      (today: only /health).
 *
 *   2. `PermissionGuard` (per-route, applied via `@UseGuards` on the
 *      employees controller) â€” reads `@RequirePermission(...)`,
 *      fetches the user's effective permissions from auth-service,
 *      caches in Redis 5 min.
 *
 *   3. `StorageModule.forRoot()` â€” injects the @szdevs/storage
 *      adapter behind the `STORAGE` token. Uses `STORAGE_PROVIDER`
 *      env to pick R2 (prod) or local (dev).
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
    StorageModule.forRoot(),
    EmployeesModule,
    DepartmentsModule,
    PositionsModule,
    VacationsModule,
    WorkSchedulesModule,
    HealthModule,
  ],
  providers: [
    JwtStrategy,
    // Every route protected by default; @Public() opts out.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
