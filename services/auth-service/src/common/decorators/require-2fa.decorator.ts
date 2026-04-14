import { SetMetadata } from '@nestjs/common';

/**
 * Marker metadata key read by `TwoFactorGuard`. When set on a route
 * handler or controller class, the guard rejects requests whose
 * authenticated user does not have `twoFactorEnabled: true`.
 *
 * Usage:
 *   @Require2FA()
 *   @Get('sensitive')
 *   getSensitive() { ... }
 *
 *   // or on a whole controller:
 *   @Require2FA()
 *   @Controller('admin')
 *   class AdminController { ... }
 */
export const REQUIRE_2FA_KEY = 'require2FA';

export const Require2FA = (): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_2FA_KEY, true);
