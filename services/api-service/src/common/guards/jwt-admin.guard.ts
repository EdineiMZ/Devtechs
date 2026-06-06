import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

interface JwtPayload {
  sub: string;
  email?: string;
  permissions?: string[];
  roles?: string[];
  iat?: number;
  exp?: number;
}

/**
 * JWT guard for internal admin routes (`/internal/api-keys/*`).
 *
 * Validates `Authorization: Bearer <jwt>` using `JWT_SECRET` env var
 * (the same secret as auth-service). Attaches the decoded payload to
 * `request.user` on success.
 *
 * Also verifies the token contains the `integrations:manage` permission
 * so only privileged admin users can manage API keys.
 */
@Injectable()
export class JwtAdminGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user: JwtPayload }>();

    const token = this.extractBearer(req);
    if (!token) {
      throw new UnauthorizedException('Missing JWT token');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired JWT token');
    }

    const permissions: string[] = payload.permissions ?? [];
    if (!permissions.includes('integrations:manage')) {
      throw new UnauthorizedException(
        'Insufficient permissions: integrations:manage required',
      );
    }

    req.user = payload;
    return true;
  }

  private extractBearer(req: Request): string | null {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) return null;
    return auth.slice(7).trim();
  }
}
