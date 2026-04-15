import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

/** Shape of the user attached to the request by `JwtStrategy.validate()`. */
export interface CurrentUserPayload {
  id: string;
  email: string;
  sessionId: string;
}

interface RequestWithUser extends Request {
  user?: CurrentUserPayload;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
