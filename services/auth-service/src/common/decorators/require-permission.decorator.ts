import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';

/**
 * Require that the authenticated user holds ALL of the listed
 * permission keys. Pairs with `PermissionGuard`.
 *
 *   @UseGuards(PermissionGuard)
 *   @RequirePermission('rh:employees:edit')
 *   @Patch('employees/:id')
 *   update(...) { ... }
 *
 * Pass several keys to require the union of them:
 *
 *   @RequirePermission('projects:tasks:assign', 'projects:sprints:manage')
 *
 * Users holding the `admin` role bypass permission checks entirely
 * (see `PermissionGuard`).
 */
export const RequirePermission = (
  ...permissions: string[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissions);
