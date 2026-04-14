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
import { REQUIRE_EMAIL_VERIFIED_KEY } from '../decorators/require-email-verified.decorator';
import { PrismaService } from '../../prisma/prisma.service';

interface RequestWithUser extends Request {
  user?: CurrentUserPayload;
}

/**
 * Blocks access to routes marked `@RequireEmailVerified()` for users whose
 * email has not yet been verified.
 *
 * Must run AFTER `JwtAuthGuard` so that `request.user` is already populated.
 * The simplest way to wire this is either:
 *
 *   1. As a global guard registered after `JwtAuthGuard` via `APP_GUARD`, or
 *   2. Per-route alongside the global JwtAuthGuard:
 *        @UseGuards(EmailVerifiedGuard)
 *        @RequireEmailVerified()
 *        @Get('me')
 *        me(...) { ... }
 *
 * When the metadata key is not present, the guard is a pass-through so
 * applying it globally is safe.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_EMAIL_VERIFIED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) {
      // If somebody applies @RequireEmailVerified() to a @Public() route,
      // surface that as "must authenticate first" rather than a 500.
      throw new UnauthorizedException('Authentication required');
    }

    // We re-read the flag from the DB rather than trusting a claim
    // baked into the JWT — the token is issued at login and may be
    // minutes or hours stale. Email verification happens out-of-band.
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { emailVerified: true },
    });

    if (!dbUser?.emailVerified) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'EmailNotVerified',
        message:
          'Your email address has not been verified. Please check your inbox or request a new verification email at POST /auth/email/send-verification.',
      });
    }

    return true;
  }
}
