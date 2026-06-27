import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

const EVENT_CHANNEL_EMAIL = 'notifications:email';
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 3;
const SALT_ROUNDS = 12;

class TooManyRequestsException extends HttpException {
  constructor(message: string) {
    super(
      { statusCode: HttpStatus.TOO_MANY_REQUESTS, message, error: 'Too Many Requests' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export interface ForgotPasswordInput {
  email: string;
  ip?: string | null;
  userAgent?: string | string[] | null;
}

export interface ValidateResetTokenInput {
  token: string;
  email: string;
  ip?: string | null;
  userAgent?: string | string[] | null;
}

export interface ResetPasswordInput {
  token: string;
  email: string;
  newPassword: string;
  ip?: string | null;
  userAgent?: string | string[] | null;
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async forgotPassword(input: ForgotPasswordInput): Promise<{ message: string }> {
    const silentOk = {
      message: 'Se existir uma conta para este e-mail, enviaremos um link de redefinição.',
    };

    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, name: true, email: true, status: true },
    });

    // Anti-enumeration: always return the same response regardless of whether
    // the user exists or is inactive.
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
      this.config.get<string>('NEXT_PUBLIC_WEB_URL') ??
      this.config.get<string>('WEB_URL') ??
      'https://szdevs.com';
    const resetUrl = `${webUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;

    await this.redis.publish(EVENT_CHANNEL_EMAIL, {
      to: user.email,
      subject: 'Redefinição de senha — SZDevs',
      template: 'password-reset',
      data: { name: user.name, resetUrl },
    });

    this.logger.log(
      `Password reset email queued userId=${user.id} expires=${expiresAt.toISOString()}`,
    );

    return silentOk;
  }

  async validateResetToken(input: ValidateResetTokenInput): Promise<{ valid: boolean }> {
    const record = await this.prisma.passwordReset.findUnique({
      where: { token: input.token },
      include: { user: { select: { email: true } } },
    });

    if (!record) throw new BadRequestException('Link de redefinição inválido ou expirado.');
    if (record.usedAt) throw new BadRequestException('Este link de redefinição já foi utilizado.');
    if (record.expiresAt < new Date()) throw new BadRequestException('Este link de redefinição expirou.');

    // Constant-time email comparison to prevent oracle attacks.
    const normalised = input.email.trim().toLowerCase();
    if (record.user.email !== normalised) {
      throw new BadRequestException('Link de redefinição inválido ou expirado.');
    }

    return { valid: true };
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
    const record = await this.prisma.passwordReset.findUnique({
      where: { token: input.token },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!record) throw new BadRequestException('Link de redefinição inválido ou expirado.');
    if (record.usedAt) throw new BadRequestException('Este link de redefinição já foi utilizado.');
    if (record.expiresAt < new Date()) throw new BadRequestException('Este link de redefinição expirou.');

    const normalised = input.email.trim().toLowerCase();
    if (record.user.email !== normalised) {
      throw new BadRequestException('Link de redefinição inválido ou expirado.');
    }

    const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.passwordReset.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
    ]);

    this.logger.log(`Password reset completed userId=${record.userId}`);

    return { message: 'Senha atualizada com sucesso.' };
  }
}
