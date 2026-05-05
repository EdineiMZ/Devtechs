import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

import { TwoFactorService } from './two-factor.service';

const EVENT_CHANNEL_EMAIL = 'notifications:email';
const RESET_TTL_MS = 1000 * 60 * 60; // 1 hour
const RATE_LIMIT_WINDOW_MS = 1000 * 60 * 60; // 1h
const RATE_LIMIT_MAX = 3;
const SALT_ROUNDS = 12;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  async forgotPassword(email: string): Promise<{ message: string }> {
    const silentOk = { message: 'Se o email estiver cadastrado, voce receberá um link de redefinicao.' };

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') return silentOk;

    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recent = await this.prisma.passwordReset.count({
      where: { userId: user.id, createdAt: { gte: since } },
    });
    if (recent >= RATE_LIMIT_MAX) return silentOk;

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);

    await this.prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt },
    });

    const webUrl =
      this.config.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'https://szdevs.com';
    const resetUrl = ${webUrl}/redefinir-senha?token=;

    await this.redis.publish(EVENT_CHANNEL_EMAIL, {
      to: user.email,
      subject: 'Redefinicao de senha - SZDevs',
      template: 'password-reset',
      data: { name: user.name, resetUrl },
    });

    this.logger.log(
      Password reset email queued for  (); expires ,
    );

    return silentOk;
  }

  async resetPassword(
    token: string,
    newPassword: string,
    totpCode?: string,
    ipAddress?: string | null,
  ): Promise<{ message: string; requires2FA?: boolean }> {
    const record = await this.prisma.passwordReset.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            twoFactorEnabled: true,
          },
        },
      },
    });

    if (!record) throw new BadRequestException('Token invalido ou nao encontrado');
    if (record.usedAt) throw new BadRequestException('Este link ja foi utilizado');
    if (record.expiresAt < new Date()) throw new BadRequestException('Este link expirou');

    if (record.user.twoFactorEnabled) {
      if (!totpCode) {
        return { message: 'ok', requires2FA: true };
      }
      try {
        await this.twoFactor.verifySession(record.user.id, totpCode, ipAddress);
      } catch {
        throw new UnauthorizedException(
          'Codigo do autenticador invalido ou expirado',
        );
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await this.prisma.([
      this.prisma.passwordReset.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { password: hashedPassword },
      }),
    ]);

    this.logger.log(Password reset completed for user );

    return { message: 'Senha redefinida com sucesso' };
  }

  async getResetInfo(
    token: string,
  ): Promise<{ valid: boolean; requires2FA: boolean; expiresAt: string }> {
    const record = await this.prisma.passwordReset.findUnique({
      where: { token },
      include: {
        user: {
          select: { twoFactorEnabled: true },
        },
      },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return { valid: false, requires2FA: false, expiresAt: '' };
    }

    return {
      valid: true,
      requires2FA: record.user.twoFactorEnabled,
      expiresAt: record.expiresAt.toISOString(),
    };
  }
}