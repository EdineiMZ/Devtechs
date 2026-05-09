import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';

import { RealIp } from '../../common/decorators/real-ip.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { InternalSecretGuard } from '../../common/guards/internal-secret.guard';

import type { LoginSuccessResponse } from './dto/auth-response.dto';
import { OAuthLoginDto } from './dto/oauth-login.dto';
import { OAuthAuthService } from './oauth-auth.service';

/**
 * Internal endpoint called by `apps/web` after a successful Google /
 * GitHub OAuth dance. Responsible for account linking and token
 * issuing.
 *
 * Guard stack:
 *   1. `@Public()` — skip the global JWT guard (the caller is the
 *      NextAuth server, not a user session).
 *   2. `@SkipThrottle()` — skip the global 100/min throttler; the
 *      NextAuth server is a single consumer and the throttler would
 *      start blocking legitimate OAuth flows under load.
 *   3. `InternalSecretGuard` — requires the `X-Internal-Secret`
 *      header to match `AUTH_INTERNAL_SECRET`. Fail-closed: a
 *      deployment without the secret configured rejects every call.
 */
@Controller('auth/oauth')
@Public()
@SkipThrottle()
@UseGuards(InternalSecretGuard)
export class OAuthController {
  constructor(private readonly oauthAuthService: OAuthAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body() dto: OAuthLoginDto,
    @RealIp() ip: string,
    @Req() req: Request,
  ): Promise<LoginSuccessResponse> {
    const userAgent = req.headers['user-agent'] ?? null;
    return this.oauthAuthService.loginOrLink(dto, {
      ipAddress: ip,
      userAgent,
    });
  }
}
