import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { CurrentUserPayload } from '../decorators/current-user.decorator';
import { REQUIRE_2FA_KEY } from '../decorators/require-2fa.decorator';
import { PrismaService } from '../../prisma/prisma.service';

interface RequestWithUser extends Request {
  user?: CurrentUserPayload;
}

/**
 * Blocks access to routes marked `@Require2FA()` for users who have not
 * enabled two-factor authentication on their account.
 *
 * Must run AFTER `JwtAuthGuard` so that `request.user` is already
 * populated. Apply per-route:
 *
 *     @UseGuards(TwoFactorGuard)
 *     @Require2FA()
 *     @Post('some/sensitive/action')
 *     doSensitive() { ... }
 *
 * Or globally (registered after `JwtAuthGuard` via `APP_GUARD`) — in
 * which case it is a pass-through for routes without the metadata.
 *
 * The guard checks `twoFactorEnabled` on the User row, not something
 * baked into the JWT, so toggling 2FA via /auth/2fa/enable takes effect
 * immediately without forcing the user to log back in.
 */
@Injectable()
export class TwoFactorGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_2FA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true },
    });

    if (!dbUser?.twoFactorEnabled) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'TwoFactorRequired',
        message:
          'This action requires two-factor authentication to be enabled on your account. Please set it up at POST /auth/2fa/setup first.',
      });
    }

    return true;
  }
}
