import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { getRealIp } from '../utils/real-ip';

export const RealIp = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return getRealIp(req);
  },
);
