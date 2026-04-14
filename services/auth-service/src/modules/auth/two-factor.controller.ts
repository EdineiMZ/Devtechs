import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { THROTTLERS } from '../../common/rate-limit/rate-limit.module';

import { JwtTwoFactorTempAuthGuard } from './auth.guard';
import type {
  Disable2FAResponse,
  Enable2FAResponse,
  LoginSuccessResponse,
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
   * Gated by `JwtAuthGuard` (global) — the user must be logged in.
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
    @Ip() ip: string,
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
    @Ip() ip: string,
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
   * request for lacking a full access token — the `JwtTwoFactorTempAuthGuard`
   * takes over and validates the temp token on the body.
   */
  @Public()
  @Throttle({
    [THROTTLERS.TWO_FA_VERIFY]: { limit: 10, ttl: 5 * 60_000 },
  })
  @UseGuards(JwtTwoFactorTempAuthGuard)
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(
    @Body() dto: Verify2FADto,
    @Req() req: RequestWithTempUser,
    @Ip() ip: string,
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
}
