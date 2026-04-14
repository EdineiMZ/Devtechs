import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { AuditAction } from '../../common/constants/audit-actions';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequireEmailVerified } from '../../common/decorators/require-email-verified.decorator';
import { EmailVerifiedGuard } from '../../common/guards/email-verified.guard';
import { LoginRateLimitGuard } from '../../common/rate-limit/login-rate-limit.guard';
import { THROTTLERS } from '../../common/rate-limit/rate-limit.module';

import { JwtRefreshAuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import type {
  LoginResponse,
  LogoutResponse,
  RefreshResponse,
  RegisterResponse,
  SendVerificationResponse,
  VerifyEmailResponse,
} from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailQueryDto } from './dto/verify-email.dto';
import { EmailVerificationService } from './email-verification.service';
import type { RefreshTokenContext } from './strategies/jwt-refresh.strategy';

interface RequestWithRefresh extends Request {
  user?: RefreshTokenContext;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  // -------------------------------------------------------------------
  // Register / Login / Refresh / Logout
  // -------------------------------------------------------------------

  @Public()
  @Throttle({
    [THROTTLERS.REGISTER]: { limit: 10, ttl: 60 * 60_000 },
  })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto): Promise<RegisterResponse> {
    return this.authService.register(dto);
  }

  @Public()
  // The custom LoginRateLimitGuard enforces the 5/15min + 1h-block rule.
  // We skip the `default` global throttler here because the login guard
  // already provides stricter protection against brute-force attempts.
  @UseGuards(LoginRateLimitGuard)
  @SkipThrottle({ [THROTTLERS.DEFAULT]: true })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<LoginResponse> {
    const userAgent = req.headers['user-agent'] ?? null;
    return this.authService.login(dto, { ipAddress: ip, userAgent });
  }

  @Public()
  @UseGuards(JwtRefreshAuthGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body() _dto: RefreshTokenDto,
    @Req() req: RequestWithRefresh,
  ): Promise<RefreshResponse> {
    // JwtRefreshStrategy has already validated the token signature and
    // populated req.user with the decoded payload + raw token.
    const ctx = req.user;
    if (!ctx) {
      throw new Error('Refresh token context missing on request');
    }
    const { rawToken, ...payload } = ctx;
    return this.authService.refresh(payload, rawToken);
  }

  @Audit(AuditAction.LOGOUT)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(
    @CurrentUser() user: CurrentUserPayload,
    @Ip() ip: string,
  ): Promise<LogoutResponse> {
    return this.authService.logout(user.sessionId, ip);
  }

  // -------------------------------------------------------------------
  // Email verification
  // -------------------------------------------------------------------

  /**
   * Generates a fresh 24h verification token for the authenticated user
   * and publishes an `notifications:email` event for notification-service
   * to actually send the email.
   *
   * Two layers of rate limiting:
   *   - `CustomThrottlerGuard` (global) applies the `email-verification`
   *     bucket: 3 requests per userId per hour. The tracker override in
   *     that guard keys off `user:<id>` instead of the IP.
   *   - The service itself has a hard limit of 3 pending tokens per
   *     user per hour as a second line of defense (in case the global
   *     throttler ever misconfigures).
   */
  @Throttle({
    [THROTTLERS.EMAIL_VERIFICATION]: { limit: 3, ttl: 60 * 60_000 },
  })
  @Post('email/send-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  sendVerification(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<SendVerificationResponse> {
    return this.emailVerificationService.sendVerification(user.id);
  }

  /**
   * Public endpoint clicked from the verification email. Validates the
   * token, flips `emailVerified`, writes an audit log entry, and returns
   * a success payload. Intended to be called either directly by the user's
   * browser or by a frontend page that forwards the token.
   */
  @Public()
  @Get('email/verify')
  @HttpCode(HttpStatus.OK)
  verifyEmail(
    @Query() query: VerifyEmailQueryDto,
    @Ip() ip: string,
  ): Promise<VerifyEmailResponse> {
    return this.emailVerificationService.verify(query.token, ip);
  }

  // -------------------------------------------------------------------
  // Example of @RequireEmailVerified() in action
  // -------------------------------------------------------------------

  /**
   * Returns the currently authenticated user's profile claims.
   *
   * Protected by two gates:
   *   1. The global `JwtAuthGuard` — ensures a valid access token.
   *   2. `EmailVerifiedGuard` + `@RequireEmailVerified()` — ensures the
   *      user has confirmed their email address. Unverified users get
   *      a clear 403 with the `EmailNotVerified` error code pointing
   *      them at `POST /auth/email/send-verification`.
   */
  @UseGuards(EmailVerifiedGuard)
  @RequireEmailVerified()
  @Get('me')
  @HttpCode(HttpStatus.OK)
  me(@CurrentUser() user: CurrentUserPayload): CurrentUserPayload {
    return user;
  }
}
