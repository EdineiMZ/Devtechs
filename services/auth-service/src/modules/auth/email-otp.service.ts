import { randomInt } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

import { AuthService, type LoginContext } from './auth.service';
import type { LoginSuccessResponse } from './dto/auth-response.dto';

/** Redis key prefix for login OTP codes. */
const OTP_KEY_PREFIX = 'emailotp:';
/** OTP validity window. */
const OTP_TTL_SECONDS = 10 * 60; // 10 minutes
/** Channel consumed by notification-service for email delivery. */
const EVENT_CHANNEL_EMAIL = 'notifications:email';

@Injectable()
export class EmailOtpService {
  private readonly logger = new Logger(EmailOtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {}

  // -------------------------------------------------------------------
  // POST /auth/email-otp/request
  // -------------------------------------------------------------------

  /**
   * Generates a 6-digit OTP for the given email, stores it in Redis
   * with a 10-minute TTL, and publishes an email via notification-service.
   *
   * Always returns 200 with the same message regardless of whether the
   * user exists — prevents account enumeration.
   */
  async request(email: string): Promise<{ message: string }> {
    const normalised = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalised },
      select: { id: true, name: true, email: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      // Don't reveal existence — return the same success shape.
      this.logger.log(`Email OTP requested for unknown/inactive email: ${normalised}`);
      return { message: 'If this email is registered, a login code has been sent.' };
    }

    // 6-digit numeric code: 000000–999999.
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const key = `${OTP_KEY_PREFIX}${normalised}`;

    await this.redis.setWithTTL(key, code, OTP_TTL_SECONDS);

    await this.redis.publish(EVENT_CHANNEL_EMAIL, {
      to: user.email,
      subject: 'Seu código de acesso - SZDevs',
      template: 'login-otp',
      data: {
        name: user.name,
        code,
        expiresInMinutes: '10',
      },
    });

    this.logger.log(`Email OTP sent to ${normalised} (${user.id})`);
    return { message: 'If this email is registered, a login code has been sent.' };
  }

  // -------------------------------------------------------------------
  // POST /auth/email-otp/verify
  // -------------------------------------------------------------------

  /**
   * Verifies the OTP. On success deletes the Redis key (single-use)
   * and calls `AuthService.completeLogin()` to issue real session tokens.
   */
  async verify(
    email: string,
    code: string,
    ctx: LoginContext,
  ): Promise<LoginSuccessResponse> {
    const normalised = email.trim().toLowerCase();
    const key = `${OTP_KEY_PREFIX}${normalised}`;

    const stored = await this.redis.get(key);
    if (!stored) {
      throw new BadRequestException(
        'Código expirado ou inválido. Solicite um novo código.',
      );
    }

    // Constant-time comparison to resist timing attacks.
    // Both strings are exactly 6 chars so Buffer comparison is fine.
    const expected = Buffer.from(stored);
    const received = Buffer.from(code.trim().padStart(6, '0'));
    const match =
      expected.length === received.length &&
      Buffer.compare(expected, received) === 0;

    if (!match) {
      throw new UnauthorizedException(
        'Código incorreto. Verifique e tente novamente.',
      );
    }

    // Consume the code — one-time use only.
    await this.redis.del(key);

    const user = await this.prisma.user.findUnique({
      where: { email: normalised },
      select: { id: true, status: true },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    return this.authService.completeLogin(user.id, ctx);
  }
}
