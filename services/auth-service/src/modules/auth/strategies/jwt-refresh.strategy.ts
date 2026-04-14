import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  typ: 'refresh';
  iat?: number;
  exp?: number;
}

export interface RefreshTokenContext extends RefreshTokenPayload {
  /** Raw refresh token string, used by the service to match it in the DB. */
  rawToken: string;
}

/**
 * Strategy used ONLY by the `/auth/refresh` endpoint. It reads the refresh
 * token from the request body (not the Authorization header) and forwards
 * the raw string alongside the decoded payload so the service can match
 * it against the hashed value stored in the `sessions` table.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: RefreshTokenPayload): RefreshTokenContext {
    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const body = (req.body ?? {}) as { refreshToken?: unknown };
    const rawToken = typeof body.refreshToken === 'string' ? body.refreshToken : '';
    if (!rawToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    return { ...payload, rawToken };
  }
}
