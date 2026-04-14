import { SetMetadata } from '@nestjs/common';

/**
 * Marker metadata key read by `EmailVerifiedGuard`. When present (and
 * truthy) on a route handler or controller class, the guard rejects
 * requests whose authenticated user still has `emailVerified: false`.
 *
 * Usage:
 *   @RequireEmailVerified()
 *   @Get('me')
 *   me(@CurrentUser() user) { ... }
 *
 *   // or on a whole controller:
 *   @RequireEmailVerified()
 *   @Controller('settings')
 *   class SettingsController { ... }
 */
export const REQUIRE_EMAIL_VERIFIED_KEY = 'requireEmailVerified';

export const RequireEmailVerified = (): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_EMAIL_VERIFIED_KEY, true);
