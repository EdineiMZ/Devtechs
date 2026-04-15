import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';

/**
 * Require that the authenticated user holds ALL listed permission
 * keys. Pairs with `PermissionGuard`, which resolves the user's
 * effective permissions via auth-service and caches the result in
 * Redis for 5 minutes.
 */
export const RequirePermission = (
  ...permissions: string[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissions);
