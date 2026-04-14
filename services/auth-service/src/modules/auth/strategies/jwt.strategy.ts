import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';

export interface AccessTokenPayload {
  /** User id (subject). */
  sub: string;
  email: string;
  /** Session id, used to invalidate sessions on logout. */
  sid: string;
  /** Token type discriminator. */
  typ: 'access';
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
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

  /**
   * Invoked by passport-jwt after the token signature/expiration check
   * succeeds. We re-validate the session in the database so that a
   * revoked session invalidates every access token derived from it,
   * even before the 15-minute expiration runs out.
   */
  async validate(payload: AccessTokenPayload): Promise<CurrentUserPayload> {
    if (payload.typ !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          include: {
            roles: { include: { role: true } },
          },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    if (session.userId !== payload.sub) {
      throw new UnauthorizedException('Session/user mismatch');
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      roles: session.user.roles.map((r) => r.role.name),
      sessionId: session.id,
    };
  }
}
