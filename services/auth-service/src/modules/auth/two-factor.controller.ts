import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsNumberString, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { RealIp } from '../../common/decorators/real-ip.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { THROTTLERS } from '../../common/rate-limit/rate-limit.module';

import { JwtTwoFactorTempAuthGuard } from './auth.guard';
import type {
  Disable2FAResponse,
  Enable2FAResponse,
  LoginSuccessResponse,
  RecoveryCodesResponse,
  Setup2FAResponse,
} from './dto/auth-response.dto';
import { Disable2FADto } from './dto/disable-2fa.dto';
import { Enable2FADto } from './dto/enable-2fa.dto';
import { Verify2FADto } from './dto/verify-2fa.dto';
import type { TwoFactorTempContext } from './strategies/jwt-2fa-temp.strategy';
import { TwoFactorService } from './two-factor.service';

interface RequestWithTempUser extends Request {
  user?: TwoFactorTempContext;
}

class VerifySessionDto {
  // Accepts the 6 TOTP digits with optional whitespace/dashes
  // ("123 456", "123-456"); the service normalises before verifying.
  @IsString()
  @MaxLength(12)
  @Matches(/^[\d\s-]{6,12}$/)
  code!: string;
}

class DisableWithEmailOtpDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @Length(6, 6)
  @IsNumberString({ no_symbols: true })
  emailOtp!: string;
}

@ApiTags('2fa')
@Controller('auth/2fa')
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  // -------------------------------------------------------------------
  // POST /auth/2fa/setup
  // -------------------------------------------------------------------
  /**
   * Generates a fresh TOTP secret for the authenticated user, builds a
   * QR code image (data URL) to be scanned by Google Authenticator /
   * Authy / 1Password / etc., and stashes the secret in Redis for 10
   * minutes so the user has time to scan + confirm via `/enable`.
   *
   * Gated by `JwtAuthGuard` (global) â€” the user must be logged in.
   * `TwoFactorService.setup()` additionally requires `emailVerified`.
   */
  @Post('setup')
  @HttpCode(HttpStatus.OK)
  setup(@CurrentUser() user: CurrentUserPayload): Promise<Setup2FAResponse> {
    return this.twoFactorService.setup(user.id);
  }

  // -------------------------------------------------------------------
  // POST /auth/2fa/enable
  // -------------------------------------------------------------------
  /**
   * Confirms the setup by checking a valid TOTP code against the secret
   * temporarily stored in Redis. On success, the secret is AES-256-GCM
   * encrypted with the `ENCRYPTION_KEY` and persisted to
   * `User.twoFactorSecret`, `twoFactorEnabled` is flipped, and an
   * audit-log row is written.
   */
  @Post('enable')
  @HttpCode(HttpStatus.OK)
  enable(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: Enable2FADto,
    @RealIp() ip: string,
  ): Promise<Enable2FAResponse> {
    return this.twoFactorService.enable(user.id, dto.code, ip);
  }

  // -------------------------------------------------------------------
  // POST /auth/2fa/disable
  // -------------------------------------------------------------------
  /**
   * Disables 2FA on the authenticated user's account. Requires the
   * current password (to prevent a stolen access token from being able
   * to disable the second factor on its own). Optionally accepts a
   * TOTP code for belt-and-braces confirmation.
   */
  @Post('disable')
  @HttpCode(HttpStatus.OK)
  disable(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: Disable2FADto,
    @RealIp() ip: string,
  ): Promise<Disable2FAResponse> {
    return this.twoFactorService.disable(user.id, dto.currentPassword, dto.code, ip);
  }

  // -------------------------------------------------------------------
  // POST /auth/2fa/verify  (part of the login flow)
  // -------------------------------------------------------------------
  /**
   * Second leg of the login flow when the user has 2FA enabled.
   *
   * The client has already posted to `/auth/login` and received
   * `{ requires2FA: true, tempToken, tempTokenExpiresAt }`. It now
   * re-submits `{ tempToken, code }` here. We validate the temp token
   * via `Jwt2faTempStrategy`, verify the TOTP code, and issue the
   * real access + refresh tokens exactly as a non-2FA login would.
   *
   * Marked `@Public()` so the global `JwtAuthGuard` doesn't reject the
   * request for lacking a full access token â€” the `JwtTwoFactorTempAuthGuard`
   * takes over and validates the temp token on the body.
   */
  @Public()
  @Throttle({
    [THROTTLERS.TWO_FA_VERIFY]: { limit: 10, ttl: 5 * 60_000 },
  })
  @UseGuards(JwtTwoFactorTempAuthGuard)
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete login by submitting the TOTP code',
    description:
      'Second leg of the 2FA login flow. The `tempToken` was issued by ' +
      '`POST /auth/login` (the response with `requires2FA: true`). Submit it ' +
      'together with the live 6-digit TOTP code from the user\'s authenticator ' +
      'app. On success, returns access + refresh tokens identical to a ' +
      'non-2FA login.',
  })
  @ApiBody({
    type: Verify2FADto,
    examples: {
      default: {
        summary: 'TOTP code from Google Authenticator',
        value: {
          tempToken:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW9kbGtyaGUuLi4ifQ.SignaturE',
          code: '482917',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'TOTP accepted â€” full session tokens issued.',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiI...' },
        refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiI...' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'cmodlkrhe000uf1japmgdh3w1' },
            email: { type: 'string', example: 'agent@SZDevs.com' },
            roles: { type: 'array', items: { type: 'string' }, example: ['support'] },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid temp token shape or non-numeric code.' })
  @ApiResponse({ status: 401, description: 'Wrong TOTP, expired temp token, or replayed code.' })
  @ApiResponse({ status: 429, description: 'Too many TOTP attempts in 5 min.' })
  verify(
    @Body() dto: Verify2FADto,
    @Req() req: RequestWithTempUser,
    @RealIp() ip: string,
  ): Promise<LoginSuccessResponse> {
    const ctx = req.user;
    if (!ctx) {
      throw new Error('Temp-token context missing on request');
    }
    const userAgent = req.headers['user-agent'] ?? null;
    return this.twoFactorService.verifyLogin(ctx.userId, dto.code, {
      ipAddress: ip,
      userAgent,
    });
  }

  // -------------------------------------------------------------------
  // POST /auth/2fa/recovery-codes  â€” regenerate recovery codes
  // -------------------------------------------------------------------
  /**
   * Wipes any existing recovery codes (used or not) and issues a
   * fresh batch of 8. Plaintext codes are returned ONCE; the database
   * only keeps bcrypt hashes. Requires the user to already have 2FA
   * active and to be authenticated with a full access token.
   */
  // -------------------------------------------------------------------
  // POST /auth/2fa/verify-session  (mid-session 2FA for OAuth users)
  // -------------------------------------------------------------------
  /**
   * Verifies a TOTP code for an already-authenticated user (full access
   * token required). Used when an OAuth user has 2FA enabled and the
   * frontend needs to confirm their identity before granting access to
   * /admin or /developer routes. Returns `{ verified: true }` so the
   * client can patch the session via NextAuth's unstable_update.
   */
  @Post('verify-session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify TOTP for an already-authenticated OAuth user' })
  @ApiResponse({ status: 200, schema: { example: { verified: true } } })
  @ApiResponse({ status: 401, description: 'Invalid TOTP code' })
  verifySession(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: VerifySessionDto,
    @RealIp() ip: string,
  ): Promise<{ verified: true }> {
    return this.twoFactorService.verifySession(user.id, dto.code, ip);
  }

  // -------------------------------------------------------------------
  // POST /auth/2fa/request-disable-otp
  // -------------------------------------------------------------------
  @Post('request-disable-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request an email OTP to disable 2FA' })
  requestDisableOtp(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ message: string }> {
    return this.twoFactorService.requestDisableOtp(user.id);
  }

  // -------------------------------------------------------------------
  // POST /auth/2fa/disable-with-otp
  // -------------------------------------------------------------------
  @Post('disable-with-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable 2FA using an email OTP instead of TOTP' })
  disableWithEmailOtp(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: DisableWithEmailOtpDto,
    @RealIp() ip: string,
  ): Promise<Disable2FAResponse> {
    return this.twoFactorService.disableWithEmailOtp(
      user.id,
      dto.currentPassword,
      dto.emailOtp,
      ip,
    );
  }

  @Post('recovery-codes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Regenerate the 8 one-time recovery codes',
    description:
      'Replaces every existing recovery code (used or not) with a fresh ' +
      'batch of 8. Plaintext codes are returned in the response and ' +
      'never re-shown afterwards.',
  })
  regenerateRecoveryCodes(
    @CurrentUser() user: CurrentUserPayload,
    @RealIp() ip: string,
  ): Promise<RecoveryCodesResponse> {
    return this.twoFactorService.regenerateRecoveryCodes(user.id, ip);
  }
}
