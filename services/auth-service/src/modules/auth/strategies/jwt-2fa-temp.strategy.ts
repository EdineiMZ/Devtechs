import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * Payload carried by the short-lived token issued by `/auth/login` when
 * the user has 2FA enabled. Deliberately minimal: only the user id and
 * a `typ: 'awaiting2FA'` discriminator so a temp token cannot be used
 * as an access or refresh token.
 */
export interface TwoFactorTempTokenPayload {
  sub: string;
  typ: 'awaiting2FA';
  iat?: number;
  exp?: number;
}

export interface TwoFactorTempContext {
  /** The authenticated-but-not-yet-verified user id. */
  userId: string;
}

/**
 * Used exclusively by `POST /auth/2fa/verify`. Reads the temp token from
 * the request body (so cross-origin flows don't have to round-trip it
 * through the Authorization header), validates the discriminator, and
 * surfaces only the user id to the controller.
 */
@Injectable()
export class Jwt2faTempStrategy extends PassportStrategy(Strategy, 'jwt-2fa-temp') {
  constructor(config: ConfigService) {
    const secret =
      config.get<string>('JWT_2FA_TEMP_SECRET') ??
      config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_2FA_TEMP_SECRET / JWT_SECRET not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromBodyField('tempToken'),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: TwoFactorTempTokenPayload): TwoFactorTempContext {
    if (payload.typ !== 'awaiting2FA') {
      throw new UnauthorizedException('Invalid token type');
    }
    if (!payload.sub) {
      throw new UnauthorizedException('Malformed temp token');
    }
    return { userId: payload.sub };
  }
}
