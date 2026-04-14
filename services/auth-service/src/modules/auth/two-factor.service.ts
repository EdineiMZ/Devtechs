import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

import { AuditAction } from '../../common/constants/audit-actions';
import { CryptoService } from '../../common/crypto/crypto.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';

import { AuthService, type LoginContext } from './auth.service';
import type {
  Disable2FAResponse,
  Enable2FAResponse,
  LoginSuccessResponse,
  Setup2FAResponse,
} from './dto/auth-response.dto';

/** Redis key prefix for the pending setup secret. */
const TEMP_KEY_PREFIX = '2fa:setup:';
/** How long an unconfirmed setup secret lives in Redis. */
const SETUP_TTL_SECONDS = 10 * 60; // 10 min

// Configure otplib once at module load. 30-second steps with ±1 step
// tolerance covers normal clock drift between the client and server
// without widening the acceptance window to the point of being risky.
authenticator.options = {
  step: 30,
  window: 1,
};

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  // -------------------------------------------------------------------
  // POST /auth/2fa/setup
  // -------------------------------------------------------------------

  async setup(userId: string): Promise<Setup2FAResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        twoFactorEnabled: true,
        status: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.status !== 'ACTIVE') {
      throw new BadRequestException('Account is not active');
    }
    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Email must be verified before enabling two-factor authentication',
      );
    }
    if (user.twoFactorEnabled) {
      throw new ConflictException('Two-factor authentication is already enabled');
    }

    const secret = authenticator.generateSecret();
    const issuer = this.config.get<string>('APP_NAME') ?? 'DevTechs';
    const otpauthUrl = authenticator.keyuri(user.email, issuer, secret);
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    // Store under a per-user key with a short TTL. We intentionally do
    // NOT persist the secret to Postgres until the user proves they
    // actually scanned it by submitting a valid code via /2fa/enable.
    await this.redis.setWithTTL(`${TEMP_KEY_PREFIX}${user.id}`, secret, SETUP_TTL_SECONDS);

    this.logger.log(`2FA setup started for ${user.email} (${user.id})`);

    return { qrCode, manualKey: secret, otpauthUrl };
  }

  // -------------------------------------------------------------------
  // POST /auth/2fa/enable
  // -------------------------------------------------------------------

  async enable(
    userId: string,
    code: string,
    ipAddress?: string | null,
  ): Promise<Enable2FAResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, twoFactorEnabled: true, status: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.status !== 'ACTIVE') {
      throw new BadRequestException('Account is not active');
    }
    if (user.twoFactorEnabled) {
      throw new ConflictException('Two-factor authentication is already enabled');
    }

    const setupKey = `${TEMP_KEY_PREFIX}${user.id}`;
    const secret = await this.redis.get(setupKey);
    if (!secret) {
      throw new BadRequestException(
        'No pending 2FA setup found. Start again with POST /auth/2fa/setup.',
      );
    }

    const valid = authenticator.verify({ token: code, secret });
    if (!valid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    const encryptedSecret = this.crypto.encrypt(secret);
    const enabledAt = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: encryptedSecret,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: '2FA_ENABLED',
          module: 'AUTH',
          meta: { email: user.email },
          ipAddress: ipAddress ?? null,
        },
      }),
    ]);

    // The temp secret is no longer needed — wipe it.
    await this.redis.del(setupKey);

    this.logger.log(`2FA enabled for ${user.email} (${user.id})`);

    return {
      message: 'Two-factor authentication enabled successfully',
      enabledAt: enabledAt.toISOString(),
    };
  }

  // -------------------------------------------------------------------
  // POST /auth/2fa/disable
  // -------------------------------------------------------------------

  async disable(
    userId: string,
    currentPassword: string,
    code: string | undefined,
    ipAddress?: string | null,
  ): Promise<Disable2FAResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        status: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.status !== 'ACTIVE') {
      throw new BadRequestException('Account is not active');
    }
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const passwordOk = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid password');
    }

    // If the client sent a code too, verify it as a second check —
    // catches the case where the password was stolen but the attacker
    // does not control the authenticator device.
    if (code) {
      if (!user.twoFactorSecret) {
        throw new BadRequestException('Missing stored 2FA secret');
      }
      let secret: string;
      try {
        secret = this.crypto.decrypt(user.twoFactorSecret);
      } catch {
        throw new BadRequestException('Stored 2FA secret is corrupted');
      }
      const valid = authenticator.verify({ token: code, secret });
      if (!valid) {
        throw new BadRequestException('Invalid TOTP code');
      }
    }

    const disabledAt = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: '2FA_DISABLED',
          module: 'AUTH',
          meta: { email: user.email, confirmedWithCode: Boolean(code) },
          ipAddress: ipAddress ?? null,
        },
      }),
    ]);

    this.logger.log(`2FA disabled for ${user.email} (${user.id})`);

    return {
      message: 'Two-factor authentication disabled successfully',
      disabledAt: disabledAt.toISOString(),
    };
  }

  // -------------------------------------------------------------------
  // POST /auth/2fa/verify  (used during login)
  // -------------------------------------------------------------------

  /**
   * Called by the `/auth/2fa/verify` controller after `Jwt2faTempStrategy`
   * has already validated the temp-token signature. Verifies the TOTP
   * code and, on success, delegates to `AuthService.completeLogin()` to
   * create the real session and issue access/refresh tokens.
   */
  async verifyLogin(
    userId: string,
    code: string,
    ctx: LoginContext,
  ): Promise<LoginSuccessResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        status: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired session');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      // If the user disabled 2FA between `/login` and `/2fa/verify`, the
      // temp token is suddenly useless. Treat that as an auth failure.
      throw new UnauthorizedException('Two-factor authentication is not active on this account');
    }

    let secret: string;
    try {
      secret = this.crypto.decrypt(user.twoFactorSecret);
    } catch {
      this.logger.error(
        `Failed to decrypt TOTP secret for user ${user.id}; check ENCRYPTION_KEY rotation`,
      );
      await this.auditService.log({
        userId: user.id,
        action: AuditAction.TWO_FA_FAILED,
        module: 'AUTH',
        meta: { reason: 'decrypt_error' },
        ipAddress: ctx.ipAddress ?? null,
      });
      throw new UnauthorizedException('Unable to verify 2FA code');
    }

    const valid = authenticator.verify({ token: code, secret });
    if (!valid) {
      await this.auditService.log({
        userId: user.id,
        action: AuditAction.TWO_FA_FAILED,
        module: 'AUTH',
        meta: { reason: 'invalid_code', email: user.email },
        ipAddress: ctx.ipAddress ?? null,
      });
      throw new UnauthorizedException('Invalid TOTP code');
    }

    // TOTP accepted — the temp token will expire on its own in 5 min.
    return this.authService.completeLogin(user.id, ctx);
  }
}
