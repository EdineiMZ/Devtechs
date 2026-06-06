import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthClientModule } from './auth-client/auth-client.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionResolverModule } from './common/permissions/permission-resolver.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { LicenseThrottlerGuard } from './common/rate-limit/throttler.guard';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { HealthModule } from './modules/health/health.module';
import { ProductsModule } from './modules/products/products.module';
import { ClientsModule } from './modules/clients/clients.module';
import { TokensModule } from './modules/tokens/tokens.module';
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
    RateLimitModule,
    PrismaModule,
    RedisModule,
    AuthClientModule,
    PermissionResolverModule,
    ProductsModule,
    ClientsModule,
    TokensModule,
    HealthModule,
  ],
  providers: [
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: LicenseThrottlerGuard,
    },
  ],
})
export class AppModule {}
