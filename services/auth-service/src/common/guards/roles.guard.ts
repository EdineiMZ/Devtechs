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
import { ROLES_KEY } from '../decorators/roles.decorator';

interface RequestWithUser extends Request {
  user?: CurrentUserPayload;
}

/**
 * Enforces `@Roles(...)` metadata by checking that the authenticated
 * user has at least one of the required role names. Must run AFTER
 * `JwtAuthGuard` so that `request.user.roles` is populated.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const hasRole = user.roles.some((role) => required.includes(role));
    if (!hasRole) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'InsufficientRole',
        message: `Requires one of: ${required.join(', ')}`,
      });
    }
    return true;
  }
}
