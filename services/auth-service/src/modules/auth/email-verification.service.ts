import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

import type {
  SendVerificationResponse,
  VerifyEmailResponse,
} from './dto/auth-response.dto';

/** Redis channel consumed by notification-service to deliver templated emails. */
const EVENT_CHANNEL_EMAIL = 'notifications:email';

/** Name of the email template notification-service uses for verification. */
const EMAIL_TEMPLATE_VERIFICATION = 'email-verification';

/** How long a freshly generated token is valid for. */
const VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24; // 24h

/** Rate-limit window for `send-verification`. */
const RATE_LIMIT_WINDOW_MS = 1000 * 60 * 60; // 1h
const RATE_LIMIT_MAX = 3;

/**
 * 429 response builder. `@nestjs/common` doesn't ship a dedicated
 * `TooManyRequestsException`, so we wrap `HttpException` ourselves.
 */
class TooManyRequestsException extends HttpException {
  constructor(message: string) {
    super(
      { statusCode: HttpStatus.TOO_MANY_REQUESTS, message, error: 'Too Many Requests' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  // -------------------------------------------------------------------
  // POST /auth/email/send-verification
  // -------------------------------------------------------------------

  async sendVerification(userId: string): Promise<SendVerificationResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        status: true,
      },
    });

    if (!user) {
      // Shouldn't happen behind JwtAuthGuard â€” defensive.
      throw new NotFoundException('User not found');
    }
    if (user.status !== 'ACTIVE') {
      throw new BadRequestException('Account is not active');
    }
    if (user.emailVerified) {
      throw new ConflictException('Email is already verified');
    }

    // Rate limit: at most `RATE_LIMIT_MAX` tokens per user per hour.
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recentCount = await this.prisma.emailVerification.count({
      where: { userId: user.id, createdAt: { gte: since } },
    });
    if (recentCount >= RATE_LIMIT_MAX) {
      throw new TooManyRequestsException(
        `Too many verification emails requested. Wait up to 1 hour and try again (limit: ${RATE_LIMIT_MAX}/hour).`,
      );
    }

    // Generate a cryptographically secure, URL-safe token (hex, 64 chars).
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    await this.prisma.emailVerification.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Build the click-through URL. Prefer an explicit override so the
    // frontend (behind nginx) can own the landing page; otherwise fall
    // back to the auth-service's own GET /auth/email/verify endpoint.
    const baseUrl =
      this.config.get<string>('EMAIL_VERIFICATION_URL') ??
      `${this.config.get<string>('NEXT_PUBLIC_API_BASE_URL') ?? 'http://localhost/api'}/auth/email/verify`;
    const verificationUrl = `${baseUrl}?token=${encodeURIComponent(token)}`;

    await this.redis.publish(EVENT_CHANNEL_EMAIL, {
      to: user.email,
      subject: 'Confirme seu email - SZDevs',
      template: EMAIL_TEMPLATE_VERIFICATION,
      data: {
        name: user.name,
        verificationUrl,
      },
    });

    this.logger.log(
      `Verification email queued for ${user.email} (${user.id}); expires ${expiresAt.toISOString()}`,
    );

    return {
      message: 'Verification email sent. Please check your inbox.',
      expiresAt: expiresAt.toISOString(),
    };
  }

  // -------------------------------------------------------------------
  // GET /auth/email/verify?token=xxx
  // -------------------------------------------------------------------

  async verify(token: string, ipAddress?: string | null): Promise<VerifyEmailResponse> {
    const record = await this.prisma.emailVerification.findUnique({
      where: { token },
      include: {
        user: {
          select: { id: true, email: true, emailVerified: true },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Invalid or unknown verification token');
    }
    if (record.usedAt) {
      throw new BadRequestException('Verification token has already been used');
    }
    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Verification token has expired');
    }

    const verifiedAt = new Date();

    // Single transaction: mark the token as used, flip the user flag,
    // and write the audit log. If any step fails, none are applied.
    await this.prisma.$transaction([
      this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { usedAt: verifiedAt },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: verifiedAt,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: record.userId,
          action: 'EMAIL_VERIFIED',
          module: 'AUTH',
          resourceId: record.id,
          meta: {
            email: record.user.email,
            tokenId: record.id,
          },
          ipAddress: ipAddress ?? null,
        },
      }),
    ]);

    this.logger.log(
      `Email verified for ${record.user.email} (${record.userId}) via token ${record.id}`,
    );

    return {
      message: 'Email verified successfully',
      userId: record.userId,
      verifiedAt: verifiedAt.toISOString(),
    };
  }
}
