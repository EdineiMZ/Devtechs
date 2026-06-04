import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ApiKey } from '@szdevs/database';
import type { Request } from 'express';

import { REQUIRE_API_PERMISSION_KEY } from '../decorators/require-api-permission.decorator';

/**
 * Checks that the authenticated API key holds all permissions required by the
 * route. Must be used AFTER `ApiKeyGuard` (which populates `request.apiKey`).
 *
 * If no `@RequireApiPermission(...)` decorator is present the guard passes
 * through, allowing routes that only need a valid key (no specific permission).
 */
@Injectable()
export class RequireApiPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRE_API_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      // No specific permissions required — any valid API key can proceed.
      return true;
    }

    const req = context.switchToHttp().getRequest<Request & { apiKey: ApiKey }>();
    const apiKey = req.apiKey;

    if (!apiKey) {
      throw new ForbiddenException('API key not authenticated');
    }

    const missing = required.filter((perm) => !apiKey.permissions.includes(perm));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `API key missing required permissions: ${missing.join(', ')}`,
      );
    }

    return true;
  }
}
