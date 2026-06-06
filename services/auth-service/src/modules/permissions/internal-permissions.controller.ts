import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/public.decorator';
import { InternalSecretGuard } from '../../common/guards/internal-secret.guard';
import { THROTTLERS } from '../../common/rate-limit/rate-limit.module';

import { PermissionsService } from './permissions.service';

/**
 * Internal permission-lookup endpoint.
 *
 * Sibling services (rh-service, projects-service, etc.) cannot embed
 * the Prisma schema — they run their own Postgres connection pool
 * and don't have permission-table access. Instead they call this
 * endpoint through the shared docker network to resolve a user's
 * effective permission set, and cache the answer in Redis for 5
 * minutes via their own `PermissionGuard`.
 *
 * Guard stack:
 *   - `@Public()` skips the global JwtAuthGuard (the caller has no
 *     session — it's a service-to-service HTTP call).
 *   - `@SkipThrottle()` bypasses ALL throttler buckets because the callers
 *     are a fixed set of internal services, not end users. Using the
 *     explicit map form because the no-arg default only skips 'default'.
 *   - `InternalSecretGuard` requires the `X-Internal-Secret` header
 *     to match `AUTH_INTERNAL_SECRET` — the same guard used by
 *     `/auth/oauth/login`. Fail-closed: a deployment without the
 *     secret rejects every call.
 *
 * NOTE on route prefix: we use `@Controller('auth/permissions')` so
 * the final URL matches the spec exactly (`/auth/permissions/:userId`).
 * The older admin-facing `PermissionsController` at
 * `@Controller('permissions')` still owns the list/grant/revoke
 * endpoints; the two coexist without conflicting because they live
 * at different prefixes.
 */
@Controller('auth/permissions')
@Public()
@SkipThrottle({
  [THROTTLERS.DEFAULT]: true,
  [THROTTLERS.REGISTER]: true,
  [THROTTLERS.EMAIL_VERIFICATION]: true,
  [THROTTLERS.TWO_FA_VERIFY]: true,
})
@UseGuards(InternalSecretGuard)
export class InternalPermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get(':userId')
  @HttpCode(HttpStatus.OK)
  getUserPermissions(
    @Param('userId') userId: string,
  ): Promise<{ userId: string; permissions: string[] }> {
    return this.permissionsService.getUserPermissions(userId);
  }
}
