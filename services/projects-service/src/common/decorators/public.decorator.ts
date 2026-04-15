import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route handler (or controller) as publicly accessible,
 * bypassing the global `JwtAuthGuard`. Used for /health.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
