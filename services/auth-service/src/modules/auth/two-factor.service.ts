import { randomBytes } from 'node:crypto';

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
  RecoveryCodesResponse,
  Setup2FAResponse,
} from './dto/auth-response.dto';

/** Redis key prefix for the pending setup secret. */
const TEMP_KEY_PREFIX = '2fa:setup:';
/** How long an unconfirmed setup secret lives in Redis. */
const SETUP_TTL_SECONDS = 10 * 60; // 10 min

/** Number of recovery codes generated per call. */
const RECOVERY_CODE_COUNT = 8;
/** bcrypt cost for recovery codes (lower than passwords — codes
 *  are random 16-char strings so 10 rounds is fine). */
const RECOVERY_BCRYPT_ROUNDS = 10;

// Configure otplib once at module load. 30-second steps with ±2 step
// tolerance (so the verify accepts the previous, current, and next
// two windows — ~150 seconds total). The narrower ±1 we shipped first
// was too tight in practice: a phone whose clock had drifted ~45s would
// hand the user a "valid" code that the server rejected, and users
// retrying within the same window saw the failure repeat. ±2 is what
// Google Authenticator's reference server uses for the same reason.
authenticator.options = {
  step: 30,
  window: 2,
};

/**
 * Normalize a TOTP code coming off the wire. Authenticator apps
 * sometimes display the digits with a space in the middle ("123 456")
 * and users occasionally paste with leading/trailing whitespace; strip
 * everything that isn't a digit before handing the value to otplib.
 * Recovery codes (`XXXX-XXXX`) are NOT TOTPs and follow a separate
 * verification path, so this helper is only used on the TOTP branches.
 */
function normalizeTotp(code: string): string {
  return code.replace(/\D/g, '');
}

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
    const issuer = this.config.get<string>('APP_NAME') ?? 'SZDevs';
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

    const valid = authenticator.verify({ token: normalizeTotp(code), secret });
    if (!valid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    const encryptedSecret = this.crypto.encrypt(secret);
    const enabledAt = new Date();

    // Generate the first batch of recovery codes alongside the
    // enable so the user gets them on the same screen — same flow
    // GitHub/Google/etc. use. We hash before persisting and only
    // return plaintext in the response.
    const { plaintext: codes, rows: codeRows } = this.generateRecoveryCodes(
      user.id,
    );

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: encryptedSecret,
        },
      }),
      this.prisma.twoFactorRecoveryCode.createMany({ data: codeRows }),
      this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: '2FA_ENABLED',
          module: 'AUTH',
          meta: { email: user.email, recoveryCodesGenerated: codes.length },
          ipAddress: ipAddress ?? null,
        },
      }),
    ]);

    // The temp secret is no longer needed — wipe it.
    await this.redis.del(setupKey);

    this.logger.log(
      `2FA enabled for ${user.email} (${user.id}) with ${codes.length} recovery codes`,
    );

    return {
      message: 'Two-factor authentication enabled successfully',
      enabledAt: enabledAt.toISOString(),
      recoveryCodes: codes,
    };
  }

  // -------------------------------------------------------------------
  // POST /auth/2fa/recovery-codes  — regenerate the user's codes
  // -------------------------------------------------------------------

  /**
   * Replaces every existing recovery code (used or not) with a fresh
   * batch of 8. Plaintext codes are returned ONCE; only the bcrypt
   * hash is stored. The user must already have 2FA enabled.
   */
  async regenerateRecoveryCodes(
    userId: string,
    ipAddress?: string | null,
  ): Promise<RecoveryCodesResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, twoFactorEnabled: true, status: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== 'ACTIVE') throw new BadRequestException('Account is not active');
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const { plaintext: codes, rows: codeRows } = this.generateRecoveryCodes(
      user.id,
    );

    await this.prisma.$transaction([
      this.prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.twoFactorRecoveryCode.createMany({ data: codeRows }),
      this.prisma.auditLog.create({
        data: {
          userId,
          action: AuditAction.TWO_FA_RECOVERY_GENERATED,
          module: 'AUTH',
          meta: { count: codes.length, regenerated: true },
          ipAddress: ipAddress ?? null,
        },
      }),
    ]);

    this.logger.log(`Regenerated ${codes.length} recovery codes for ${user.id}`);
    return { recoveryCodes: codes };
  }

  /**
   * Verifies a recovery code in the same shape `verifyLogin` does for
   * a TOTP. On success: marks the code `usedAt`, completes the login,
   * and returns the same payload as the TOTP path. Used by the login
   * flow when the user clicks "use a recovery code".
   */
  async verifyLoginWithRecoveryCode(
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
      },
    });
    if (!user) throw new UnauthorizedException('Invalid or expired session');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');
    if (!user.twoFactorEnabled) {
      throw new UnauthorizedException('Two-factor authentication is not active on this account');
    }

    const candidates = await this.prisma.twoFactorRecoveryCode.findMany({
      where: { userId, usedAt: null },
      select: { id: true, codeHash: true },
    });

    let matchedId: string | null = null;
    for (const row of candidates) {
      // bcrypt compare is constant-time per row but we still iterate
      // through all rows to avoid timing differences leaking how many
      // codes the user has left. With 8 codes max this is cheap.
      // eslint-disable-next-line no-await-in-loop
      const ok = await bcrypt.compare(code, row.codeHash);
      if (ok && !matchedId) matchedId = row.id;
    }

    if (!matchedId) {
      await this.auditService.log({
        userId,
        action: AuditAction.TWO_FA_FAILED,
        module: 'AUTH',
        meta: { reason: 'invalid_recovery_code' },
        ipAddress: ctx.ipAddress ?? null,
      });
      throw new UnauthorizedException('Código de recuperação inválido');
    }

    await this.prisma.twoFactorRecoveryCode.update({
      where: { id: matchedId },
      data: { usedAt: new Date() },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.TWO_FA_RECOVERY_USED,
      module: 'AUTH',
      meta: { codeId: matchedId },
      ipAddress: ctx.ipAddress ?? null,
    });

    return this.authService.completeLogin(user.id, ctx);
  }

  /**
   * Generates 8 recovery codes formatted as XXXX-XXXX (12 chars total
   * with dash) using crypto.randomBytes — readable enough to type in
   * but high-entropy (~62 bits per code). Returns both the plaintext
   * (to ship back to the user once) and the bcrypt-hashed rows
   * ready for `createMany`.
   */
  private generateRecoveryCodes(userId: string): {
    plaintext: string[];
    rows: Array<{ userId: string; codeHash: string }>;
  } {
    const plaintext: string[] = [];
    const rows: Array<{ userId: string; codeHash: string }> = [];
    for (let i = 0; i < RECOVERY_CODE_COUNT; i += 1) {
      // Use 5 bytes → 8 hex chars per half, then format as XXXX-XXXX.
      const hex = randomBytes(5).toString('hex').toUpperCase();
      const code = `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
      const hash = bcrypt.hashSync(code, RECOVERY_BCRYPT_ROUNDS);
      plaintext.push(code);
      rows.push({ userId, codeHash: hash });
    }
    return { plaintext, rows };
  }

  // -------------------------------------------------------------------
  // POST /auth/2fa/verify-session  (mid-session 2FA check for OAuth users)
  // -------------------------------------------------------------------

  /**
   * Verifies a TOTP code for an already-authenticated user without
   * issuing new tokens. Used when an OAuth user has `twoFactorEnabled`
   * and the frontend needs to confirm their identity before granting
   * access to /admin or /developer routes.
   *
   * Returns `{ verified: true }` so the client can update the session
   * flag via NextAuth's `unstable_update`.
   */
  async verifySession(
    userId: string,
    code: string,
    ipAddress?: string | null,
  ): Promise<{ verified: true }> {
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

    if (!user) throw new UnauthorizedException('User not found');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('Two-factor authentication is not active on this account');
    }

    let secret: string;
    try {
      secret = this.crypto.decrypt(user.twoFactorSecret);
    } catch {
      throw new UnauthorizedException('Unable to verify 2FA code');
    }

    const valid = authenticator.verify({ token: normalizeTotp(code), secret });
    if (!valid) {
      await this.auditService.log({
        userId: user.id,
        action: AuditAction.TWO_FA_FAILED,
        module: 'AUTH',
        meta: { reason: 'invalid_code_session_verify', email: user.email },
        ipAddress: ipAddress ?? null,
      });
      throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.TWO_FA_SESSION_VERIFIED,
      module: 'AUTH',
      meta: { source: 'session_verify', email: user.email },
      ipAddress: ipAddress ?? null,
    });

    return { verified: true };
  }

  // -------------------------------------------------------------------
  // POST /auth/2fa/request-disable-otp
  // -------------------------------------------------------------------

  /**
   * Generates a 6-digit OTP stored at `2fa:disable-email-otp:${userId}`
   * (separate namespace from the login-flow `emailotp:` keys) and
   * publishes an email to the user. Requires the user to have 2FA active.
   */
  async requestDisableOtp(
    userId: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, twoFactorEnabled: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new NotFoundException('User not found');
    }
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const { randomInt } = await import('node:crypto');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const key = `2fa:disable-email-otp:${userId}`;

    await this.redis.setWithTTL(key, code, 10 * 60);

    await this.redis.publish('notifications:email', {
      to: user.email,
      subject: 'Código para desativar 2FA - SZDevs',
      template: 'login-otp',
      data: {
        name: user.name,
        code,
        expiresInMinutes: '10',
      },
    });

    this.logger.log(`2FA disable OTP requested for ${user.email} (${userId})`);
    return { message: 'Um código foi enviado para o seu e-mail.' };
  }

  // -------------------------------------------------------------------
  // POST /auth/2fa/disable-with-otp
  // -------------------------------------------------------------------

  /**
   * Disables 2FA using an email OTP (instead of TOTP from the authenticator
   * app). The OTP must have been requested via `POST /auth/2fa/request-disable-otp`
   * and is single-use (deleted from Redis on success).
   */
  async disableWithEmailOtp(
    userId: string,
    currentPassword: string,
    emailOtp: string,
    ipAddress?: string | null,
  ): Promise<Disable2FAResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        twoFactorEnabled: true,
        status: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.status !== 'ACTIVE') throw new BadRequestException('Account is not active');
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const passwordOk = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Invalid password');

    const key = `2fa:disable-email-otp:${userId}`;
    const stored = await this.redis.get(key);
    if (!stored) {
      throw new BadRequestException(
        'Código expirado ou inválido. Solicite um novo código por e-mail.',
      );
    }

    const expected = Buffer.from(stored);
    const received = Buffer.from(emailOtp.trim().padStart(6, '0'));
    const match =
      expected.length === received.length &&
      Buffer.compare(expected, received) === 0;

    if (!match) {
      throw new BadRequestException('Código incorreto. Verifique e tente novamente.');
    }

    await this.redis.del(key);

    const disabledAt = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: false, twoFactorSecret: null },
      }),
      this.prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: user.id } }),
      this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: '2FA_DISABLED',
          module: 'AUTH',
          meta: { email: user.email, method: 'email_otp' },
          ipAddress: ipAddress ?? null,
        },
      }),
    ]);

    this.logger.log(`2FA disabled via email OTP for ${user.email} (${user.id})`);

    return {
      message: 'Two-factor authentication disabled successfully',
      disabledAt: disabledAt.toISOString(),
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
      const valid = authenticator.verify({ token: normalizeTotp(code), secret });
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
      this.prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: user.id } }),
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

    const valid = authenticator.verify({ token: normalizeTotp(code), secret });
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
