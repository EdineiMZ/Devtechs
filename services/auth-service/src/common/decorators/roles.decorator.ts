import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route (or controller) to users holding at least one of
 * the listed role names. The role check is performed by `RolesGuard`,
 * which reads `request.user.roles` populated by `JwtStrategy`.
 *
 *   @Roles('admin')
 *   @Get('audit')
 *   listAudits() { ... }
 */
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
