import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { CurrentUserPayload } from '../decorators/current-user.decorator';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  sid: string;
  typ: 'access';
  iat?: number;
  exp?: number;
}

/**
 * JWT validation for the REST endpoints. Trusts signature + expiry;
 * WebSocket connections use their own JWT verification path (see
 * NotificationGateway) because Passport strategies don't hook into
 * socket.io's handshake flow cleanly.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET is not configured');

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
