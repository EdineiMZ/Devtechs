import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';

import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

/**
 * Global JWT auth guard. Short-circuits authentication on routes that
 * are flagged with `@Public()`.
 *
 * Registered as `APP_GUARD` in `AppModule`, so it protects every
 * controller by default.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

/**
 * Guard used only by the `/auth/refresh` endpoint. Reads the refresh
 * token from the request body (see `JwtRefreshStrategy`).
 */
@Injectable()
export class JwtRefreshAuthGuard extends AuthGuard('jwt-refresh') {}

/**
 * Guard used only by the `/auth/2fa/verify` endpoint. Reads the 5-minute
 * temp token from the request body (see `Jwt2faTempStrategy`).
 */
@Injectable()
export class JwtTwoFactorTempAuthGuard extends AuthGuard('jwt-2fa-temp') {}
