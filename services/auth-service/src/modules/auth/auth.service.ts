import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { AuditAction } from '../../common/constants/audit-actions';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';

import type {
  AuthenticatedUser,
  LoginResponse,
  LoginSuccessResponse,
  LogoutResponse,
  RefreshResponse,
  RegisterResponse,
  TwoFactorRequiredResponse,
} from './dto/auth-response.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { AccessTokenPayload } from './strategies/jwt.strategy';
import type { RefreshTokenPayload } from './strategies/jwt-refresh.strategy';

const BCRYPT_ROUNDS = 12;

/** Channel consumed by notification-service to send verification emails. */
const EVENT_CHANNEL_USER_REGISTERED = 'auth.user.registered';

/** Duration of the short-lived token used to hold the login state between
 *  password verification and TOTP verification. */
const TWO_FA_TEMP_EXPIRES_IN = '5m';
const TWO_FA_TEMP_EXPIRES_MS = 5 * 60 * 1000;

export interface LoginContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------------
  // register
  // ---------------------------------------------------------------------

  async register(dto: RegisterDto): Promise<RegisterResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        status: 'ACTIVE',
        emailVerified: false,
      },
      select: { id: true, email: true, name: true },
    });

    // Create an email verification token and emit a pub/sub event so
    // notification-service can actually deliver the email.
    const verification = await this.prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24h
      },
      select: { token: true, expiresAt: true },
    });

    await this.redis.publish(EVENT_CHANNEL_USER_REGISTERED, {
      userId: user.id,
      email: user.email,
      name: user.name,
      verificationToken: verification.token,
      verificationExpiresAt: verification.expiresAt.toISOString(),
    });

    this.logger.log(`User registered: ${user.email} (${user.id})`);

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.REGISTER,
      module: 'AUTH',
      resourceId: user.id,
      meta: { email: user.email },
    });

    return {
      message: 'Account created. Please check your email to verify your address.',
      userId: user.id,
    };
  }

  // ---------------------------------------------------------------------
  // login
  // ---------------------------------------------------------------------

  async login(dto: LoginDto, ctx: LoginContext): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        status: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      // Identical error for "user not found" and "bad password" to avoid
      // account enumeration.
      await this.auditService.log({
        action: AuditAction.LOGIN_FAILED,
        module: 'AUTH',
        meta: { email: dto.email, reason: 'user_not_found' },
        ipAddress: ctx.ipAddress ?? null,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      await this.auditService.log({
        userId: user.id,
        action: AuditAction.LOGIN_FAILED,
        module: 'AUTH',
        meta: { email: dto.email, reason: `status_${user.status.toLowerCase()}` },
        ipAddress: ctx.ipAddress ?? null,
      });
      throw new UnauthorizedException('Account is not active');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.auditService.log({
        userId: user.id,
        action: AuditAction.LOGIN_FAILED,
        module: 'AUTH',
        meta: { email: dto.email, reason: 'bad_password' },
        ipAddress: ctx.ipAddress ?? null,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Branch: if 2FA is enabled, return a 5-minute temp token and do NOT
    // create a session yet. The session is only created when /auth/2fa/verify
    // succeeds and calls `completeLogin`.
    if (user.twoFactorEnabled) {
      const twoFactor = await this.issueTwoFactorTempToken(user.id);
      this.logger.log(`User passed password check, awaiting 2FA: ${user.email} (${user.id})`);
      return twoFactor;
    }

    return this.completeLogin(user.id, ctx);
  }

  /**
   * Issues tokens and creates the session row. Called either directly from
   * `login()` when 2FA is disabled, or from `TwoFactorService.verifyLogin()`
   * after the user's TOTP code has been accepted.
   */
  async completeLogin(userId: string, ctx: LoginContext): Promise<LoginSuccessResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: { role: true },
          orderBy: { assignedAt: 'asc' },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    const sessionId = randomUUID();
    const { accessToken, refreshToken, refreshExpiresAt } =
      await this.issueTokens(user.id, user.email, sessionId);

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        token: accessToken,
        refreshToken,
        expiresAt: refreshExpiresAt,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles.map((r) => r.role.name),
      primaryRole: user.roles[0]?.role.name ?? null,
    };

    this.logger.log(`User logged in: ${user.email} (${user.id})`);

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.LOGIN_SUCCESS,
      module: 'AUTH',
      resourceId: sessionId,
      meta: {
        email: user.email,
        sessionId,
        userAgent: ctx.userAgent ?? null,
      },
      ipAddress: ctx.ipAddress ?? null,
    });

    return {
      requires2FA: false,
      accessToken,
      refreshToken,
      user: authenticatedUser,
    };
  }

  /**
   * Signs a short-lived JWT identifying the user who just passed the
   * password check and is about to submit their TOTP code. The token
   * uses its own secret (falls back to `JWT_SECRET`) so it can't be
   * accepted by the main `JwtStrategy`, and `typ: 'awaiting2FA'` is an
   * additional safeguard against cross-type reuse.
   */
  private async issueTwoFactorTempToken(userId: string): Promise<TwoFactorRequiredResponse> {
    const secret =
      this.config.get<string>('JWT_2FA_TEMP_SECRET') ??
      this.config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_2FA_TEMP_SECRET / JWT_SECRET not configured');
    }

    const tempToken = await this.jwt.signAsync(
      { sub: userId, typ: 'awaiting2FA' },
      { secret, expiresIn: TWO_FA_TEMP_EXPIRES_IN },
    );

    return {
      requires2FA: true,
      tempToken,
      tempTokenExpiresAt: new Date(Date.now() + TWO_FA_TEMP_EXPIRES_MS).toISOString(),
    };
  }

  // ---------------------------------------------------------------------
  // refresh
  // ---------------------------------------------------------------------

  async refresh(payload: RefreshTokenPayload, rawToken: string): Promise<RefreshResponse> {
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
    });

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }
    if (session.revokedAt) {
      throw new UnauthorizedException('Session has been revoked');
    }
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session has expired');
    }
    if (session.refreshToken !== rawToken) {
      // Token reuse attempt — revoke the session defensively.
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token mismatch');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User no longer active');
    }

    // Rotate: issue a brand-new pair and update the session in place.
    const { accessToken, refreshToken, refreshExpiresAt } = await this.issueTokens(
      user.id,
      user.email,
      session.id,
    );

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        token: accessToken,
        refreshToken,
        expiresAt: refreshExpiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  // ---------------------------------------------------------------------
  // logout
  // ---------------------------------------------------------------------

  async logout(sessionId: string, ipAddress?: string | null): Promise<LogoutResponse> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, revokedAt: true },
    });

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }
    if (session.revokedAt) {
      return { message: 'Already logged out' };
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await this.auditService.log({
      userId: session.userId,
      action: AuditAction.LOGOUT,
      module: 'AUTH',
      resourceId: sessionId,
      meta: { sessionId },
      ipAddress: ipAddress ?? null,
    });

    return { message: 'Logged out successfully' };
  }

  // ---------------------------------------------------------------------
  // token issuing helper
  // ---------------------------------------------------------------------

  private async issueTokens(
    userId: string,
    email: string,
    sessionId: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    refreshExpiresAt: Date;
  }> {
    const accessExpiresIn =
      this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ??
      this.config.get<string>('JWT_EXPIRES_IN') ??
      '15m';
    const refreshExpiresIn =
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const accessPayload: AccessTokenPayload = {
      sub: userId,
      email,
      sid: sessionId,
      typ: 'access',
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: userId,
      sid: sessionId,
      typ: 'refresh',
    };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: accessExpiresIn,
    });

    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn,
    });

    const refreshExpiresAt = this.computeExpiry(refreshExpiresIn);

    return { accessToken, refreshToken, refreshExpiresAt };
  }

  /**
   * Computes an absolute expiration date from a `ms`-style duration string
   * (`"7d"`, `"15m"`, etc.). Kept local to avoid pulling in another dep.
   */
  private computeExpiry(expiresIn: string): Date {
    const match = /^(\d+)\s*(ms|s|m|h|d|w)?$/i.exec(expiresIn.trim());
    if (!match) {
      throw new Error(`Invalid duration: ${expiresIn}`);
    }
    const amount = Number(match[1]);
    const unit = (match[2] ?? 's').toLowerCase();
    const multipliers: Record<string, number> = {
      ms: 1,
      s: 1000,
      m: 1000 * 60,
      h: 1000 * 60 * 60,
      d: 1000 * 60 * 60 * 24,
      w: 1000 * 60 * 60 * 24 * 7,
    };
    const ms = amount * (multipliers[unit] ?? 1000);
    return new Date(Date.now() + ms);
  }
}
