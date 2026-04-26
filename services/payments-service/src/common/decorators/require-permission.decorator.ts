import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';

export const RequirePermission = (
  ...permissions: string[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissions);
