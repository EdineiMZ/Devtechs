import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Shape of the user attached to the request by `JwtStrategy.validate()`.
 * Keep it serializable — it is what controllers will see.
 */
export interface CurrentUserPayload {
  id: string;
  email: string;
  name: string;
  roles: string[];
  sessionId: string;
}

interface RequestWithUser extends Request {
  user?: CurrentUserPayload;
}

/**
 * Controller param decorator that pulls the authenticated user (or a field
 * of it) off the request.
 *
 * Usage:
 *   @Get('me')
 *   me(@CurrentUser() user: CurrentUserPayload) { ... }
 *
 *   @Get('id')
 *   id(@CurrentUser('id') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
