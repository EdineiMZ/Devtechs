import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Shape of the user attached to the request by `JwtStrategy.validate()`.
 * Keep it minimal — rh-service trusts the JWT for identity but never
 * re-reads the session (the auth-service owns session revocation).
 */
export interface CurrentUserPayload {
  id: string;
  email: string;
  sessionId: string;
}

interface RequestWithUser extends Request {
  user?: CurrentUserPayload;
}

/**
 * Controller param decorator that pulls the authenticated user (or a
 * field of it) off the request.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
