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
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PermissionResolverService } from '../permissions/permission-resolver.service';

interface RequestWithUser extends Request {
  user?: CurrentUserPayload;
}

/**
 * Enforces `@RequirePermission(...)` metadata in projects-service.
 *
 * Delegates the resolve+cache logic to `PermissionResolverService`,
 * matching the pattern used in rh-service. Fail-closed on
 * authorization errors — a resolver failure bubbles up as a 500.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: PermissionResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const owned = await this.resolver.getPermissions(user.id);
    const missing = required.filter((key) => !owned.has(key));
    if (missing.length > 0) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'InsufficientPermission',
        message: `Missing required permission(s): ${missing.join(', ')}`,
        missing,
      });
    }
    return true;
  }
}
