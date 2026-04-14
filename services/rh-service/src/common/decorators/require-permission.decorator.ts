import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';

/**
 * Require that the authenticated user holds ALL of the listed
 * permission keys. Pairs with `PermissionGuard`, which resolves the
 * user's effective permissions by calling auth-service and caches
 * the result in Redis for 5 minutes.
 *
 * Users holding the `admin` role bypass permission checks entirely
 * (the guard short-circuits on `user.roles.includes('admin')`).
 *
 *   @UseGuards(PermissionGuard)
 *   @RequirePermission('rh:employees:edit')
 *   @Patch(':id')
 *   update(...) { ... }
 */
export const RequirePermission = (
  ...permissions: string[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissions);
