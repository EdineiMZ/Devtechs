import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { CurrentUserPayload } from '../decorators/current-user.decorator';

/**
 * Access-token JWT payload issued by auth-service. Keep the shape in
 * sync with `services/auth-service/src/modules/auth/strategies/jwt.strategy.ts`.
 */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  sid: string;
  typ: 'access';
  iat?: number;
  exp?: number;
}

/**
 * JWT validation strategy for rh-service.
 *
 * Trusts the JWT's signature + expiry for identity. We deliberately do
 * NOT re-read the session from the database here — that would require
 * either direct DB access (which the sibling-service pattern avoids)
 * or a second auth-service call on every request. Instead we rely on
 * the 15-minute access-token TTL as the bound on how long a revoked
 * session can still hit rh-service.
 *
 * The PermissionGuard (next file) does the authorization work by
 * looking up the user's effective permissions via auth-service.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: AccessTokenPayload): CurrentUserPayload {
    if (payload.typ !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    return {
      id: payload.sub,
      email: payload.email,
      sessionId: payload.sid,
    };
  }
}
