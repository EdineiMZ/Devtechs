import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { EmailVerifiedGuard } from '../../common/guards/email-verified.guard';
import { InternalSecretGuard } from '../../common/guards/internal-secret.guard';
import { TwoFactorGuard } from '../../common/guards/two-factor.guard';
import { LoginRateLimitGuard } from '../../common/rate-limit/login-rate-limit.guard';

import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AdminSessionsController } from './admin-sessions.controller';
import { AuthController } from './auth.controller';
import { UsersAdminController } from './users-admin.controller';
import { AuthService } from './auth.service';
import { EmailOtpController } from './email-otp.controller';
import { EmailOtpService } from './email-otp.service';
import { EmailVerificationService } from './email-verification.service';
import { OAuthAuthService } from './oauth-auth.service';
import { OAuthController } from './oauth.controller';
import { PasswordResetService } from './password-reset.service';
import { Jwt2faTempStrategy } from './strategies/jwt-2fa-temp.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TwoFactorController } from './two-factor.controller';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // JwtModule registered with the ACCESS token secret. The refresh
    // strategy/service and the 2FA temp-token flow sign with their own
    // secrets explicitly.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn:
            config.get<string>('JWT_ACCESS_EXPIRES_IN') ??
            config.get<string>('JWT_EXPIRES_IN') ??
            '15m',
        },
      }),
    }),
  ],
  controllers: [
    AuthController,
    AccountController,
    TwoFactorController,
    OAuthController,
    AdminSessionsController,
    UsersAdminController,
    EmailOtpController,
  ],
  providers: [
    AuthService,
    AccountService,
    EmailVerificationService,
    PasswordResetService,
    TwoFactorService,
    OAuthAuthService,
    EmailOtpService,
    JwtStrategy,
    JwtRefreshStrategy,
    Jwt2faTempStrategy,
    EmailVerifiedGuard,
    TwoFactorGuard,
    LoginRateLimitGuard,
    InternalSecretGuard,
  ],
  exports: [
    AuthService,
    AccountService,
    EmailVerificationService,
    TwoFactorService,
    OAuthAuthService,
    EmailVerifiedGuard,
    TwoFactorGuard,
  ],
})
export class AuthModule {}
