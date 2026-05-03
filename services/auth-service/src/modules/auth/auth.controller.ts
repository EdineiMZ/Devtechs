import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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

@ApiTags('auth')
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
  @ApiOperation({
    summary: 'Authenticate with email + password',
    description:
      'Returns a pair of JWTs (access + refresh) when 2FA is off. When 2FA ' +
      'is enabled, returns `requires2FA: true` and a `tempToken` that the ' +
      'client must echo back to `POST /auth/2fa/verify` with the TOTP code.',
  })
  @ApiBody({
    type: LoginDto,
    examples: {
      admin: {
        summary: 'Admin happy path',
        value: { email: 'admin@SZDevs.com', password: 'Admin@SZDevs2026' },
      },
      twoFactorPrompt: {
        summary: 'User with 2FA enabled (will return requires2FA)',
        value: { email: 'agent@SZDevs.com', password: 'Agent@2026' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login OK â€” tokens issued, or 2FA challenge returned.',
    schema: {
      oneOf: [
        {
          type: 'object',
          properties: {
            requires2FA: { type: 'boolean', example: false },
            accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'cmodlkrhe000uf1japmgdh3w1' },
                email: { type: 'string', example: 'admin@SZDevs.com' },
                name: { type: 'string', example: 'Administrador SZDevs' },
                roles: { type: 'array', items: { type: 'string' }, example: ['admin'] },
                primaryRole: { type: 'string', example: 'admin' },
                emailVerified: { type: 'boolean', example: true },
                permissions: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['auth:users:manage', 'dev:logs:view'],
                },
              },
            },
          },
        },
        {
          type: 'object',
          properties: {
            requires2FA: { type: 'boolean', example: true },
            tempToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            tempTokenExpiresAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-04-26T12:05:00.000Z',
            },
          },
        },
      ],
    },
  })
  @ApiResponse({ status: 400, description: 'Validation failed (bad email/password shape).' })
  @ApiResponse({ status: 401, description: 'Credentials do not match.' })
  @ApiResponse({ status: 429, description: 'Too many failed attempts â€” IP blocked.' })
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
   *   1. The global `JwtAuthGuard` â€” ensures a valid access token.
   *   2. `EmailVerifiedGuard` + `@RequireEmailVerified()` â€” ensures the
   *      user has confirmed their email address. Unverified users get
   *      a clear 403 with the `EmailNotVerified` error code pointing
   *      them at `POST /auth/email/send-verification`.
   */
  @UseGuards(EmailVerifiedGuard)
  @RequireEmailVerified()
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Currently authenticated user (requires verified email)' })
  @ApiResponse({ status: 200, description: 'Decoded JWT claims for the caller.' })
  @ApiResponse({ status: 401, description: 'No valid bearer token.' })
  @ApiResponse({ status: 403, description: 'Email not verified.' })
  me(@CurrentUser() user: CurrentUserPayload): CurrentUserPayload {
    return user;
  }

  // -------------------------------------------------------------------
  // LGPD art. 18, V — Portabilidade (exportar dados)
  // -------------------------------------------------------------------

  /**
   * Returns a JSON snapshot of all personal data held for the caller.
   * The response is suitable for download as `meus-dados.json`.
   *
   * Requires a verified email address because the export contains
   * sensitive personal data and we need to ensure the requester owns
   * the account.
   */
  @UseGuards(EmailVerifiedGuard)
  @RequireEmailVerified()
  @Get('me/export')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Export all personal data — LGPD art. 18, V (portabilidade)',
    description:
      'Returns a complete JSON snapshot of all personal data stored for the ' +
      'authenticated user. The response can be saved as `meus-dados.json`. ' +
      'Password hashes and 2FA secrets are never included.',
  })
  @ApiResponse({ status: 200, description: 'Data export object.' })
  @ApiResponse({ status: 401, description: 'No valid bearer token.' })
  @ApiResponse({ status: 403, description: 'Email not verified.' })
  exportMyData(
    @CurrentUser() user: CurrentUserPayload,
    @Ip() ip: string,
  ): Promise<Record<string, unknown>> {
    return this.authService.exportMyData(user.id, ip);
  }

  // -------------------------------------------------------------------
  // LGPD art. 18, VI — Eliminação (excluir conta)
  // -------------------------------------------------------------------

  /**
   * Permanently deletes the authenticated user's account.
   *
   * Requires the current password as confirmation. Audit logs are
   * retained (SET NULL on userId) per Marco Civil art. 15 and
   * fraud-prevention obligations.
   */
  @UseGuards(EmailVerifiedGuard)
  @RequireEmailVerified()
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Delete account — LGPD art. 18, VI (eliminação)',
    description:
      'Permanently deletes the account and all personally identifiable data. ' +
      'Requires `currentPassword` in the request body as confirmation. ' +
      'Cannot be undone.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['currentPassword'],
      properties: {
        currentPassword: {
          type: 'string',
          description: 'Current password for confirmation',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Account deleted.' })
  @ApiResponse({ status: 401, description: 'Bad password or no valid bearer token.' })
  @ApiResponse({ status: 403, description: 'Email not verified.' })
  deleteMyAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Body('currentPassword') currentPassword: string,
    @Ip() ip: string,
  ): Promise<{ message: string }> {
    return this.authService.deleteMyAccount(user.id, currentPassword, ip);
  }
}
