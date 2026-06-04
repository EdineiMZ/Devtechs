import { SetMetadata } from '@nestjs/common';

export const REQUIRE_API_PERMISSION_KEY = 'requireApiPermission';

/**
 * Require that the API key holds ALL of the listed permission scopes.
 * Pairs with `RequireApiPermissionGuard`.
 *
 *   @UseGuards(ApiKeyGuard, RequireApiPermissionGuard)
 *   @RequireApiPermission('tickets:read')
 *   @Get()
 *   list() { ... }
 */
export const RequireApiPermission = (
  ...permissions: string[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_API_PERMISSION_KEY, permissions);
