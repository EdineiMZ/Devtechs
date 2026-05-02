import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuditAction } from '../../common/constants/audit-actions';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const BCRYPT_ROUNDS = 12;

export interface ProfileResponse {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  status: string;
  createdAt: string;
}

export interface SessionItem {
  id: string;
  device: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  current: boolean;
}

export interface ChangePasswordResult {
  message: string;
  revokedSessionCount: number;
}

/**
 * Self-service operations on the authenticated user's own account.
 *
 * All methods take the caller's `userId` (and `currentSessionId`
 * where it matters for "current session" markers) from the JWT.
 * They never accept either as a body parameter — that's the whole
 * point of these endpoints existing alongside the admin variants
 * in `admin-sessions.controller.ts`.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // -------------------------------------------------------------------
  // PATCH /auth/me
  // -------------------------------------------------------------------

  async updateProfile(
    userId: string,
    patch: { name?: string; avatarUrl?: string },
    ipAddress?: string | null,
  ): Promise<ProfileResponse> {
    const data: { name?: string; avatarUrl?: string | null } = {};
    if (typeof patch.name === 'string' && patch.name.trim().length > 0) {
      data.name = patch.name.trim();
    }
    if (typeof patch.avatarUrl === 'string') {
      // An empty string from the form is treated as "clear the avatar".
      // Anything else passes through the @IsUrl validator on the DTO.
      data.avatarUrl = patch.avatarUrl.length > 0 ? patch.avatarUrl : null;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException(
        'Nenhum campo válido foi enviado. Informe pelo menos `name` ou `avatarUrl`.',
      );
    }

    const before = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatarUrl: true },
    });
    if (!before) throw new NotFoundException('Usuário não encontrado');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        emailVerified: true,
        twoFactorEnabled: true,
        status: true,
        createdAt: true,
      },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.PROFILE_UPDATED,
      module: 'AUTH',
      resourceId: userId,
      meta: {
        before: { name: before.name, avatarUrl: before.avatarUrl },
        after: { name: updated.name, avatarUrl: updated.avatarUrl },
      },
      ipAddress: ipAddress ?? null,
    });

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
      emailVerified: updated.emailVerified,
      twoFactorEnabled: updated.twoFactorEnabled,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  // -------------------------------------------------------------------
  // POST /auth/me/password
  // -------------------------------------------------------------------

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId: string,
    ipAddress?: string | null,
  ): Promise<ChangePasswordResult> {
    if (currentPassword === newPassword) {
      throw new BadRequestException('A nova senha deve ser diferente da atual');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, status: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (user.status !== 'ACTIVE') {
      throw new BadRequestException('Conta inativa');
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      await this.auditService.log({
        userId,
        action: AuditAction.PASSWORD_CHANGE_FAILED,
        module: 'AUTH',
        meta: { reason: 'wrong_current_password' },
        ipAddress: ipAddress ?? null,
      });
      throw new UnauthorizedException('Senha atual incorreta');
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Revoke every other active session — the new password should
    // log every other browser/device out. We deliberately keep the
    // current session alive so the user doesn't get punted to /login
    // immediately after the call returns successfully (the frontend
    // will redirect itself).
    const now = new Date();
    const [, revoked] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      }),
      this.prisma.session.updateMany({
        where: {
          userId,
          revokedAt: null,
          NOT: { id: currentSessionId },
        },
        data: { revokedAt: now },
      }),
    ]);

    await this.auditService.log({
      userId,
      action: AuditAction.PASSWORD_CHANGED,
      module: 'AUTH',
      resourceId: userId,
      meta: { revokedSessionCount: revoked.count, currentSessionId },
      ipAddress: ipAddress ?? null,
    });

    this.logger.log(
      `Password changed for user ${userId} — ${revoked.count} other session(s) revoked`,
    );

    return {
      message: 'Senha alterada com sucesso',
      revokedSessionCount: revoked.count,
    };
  }

  // -------------------------------------------------------------------
  // GET /auth/me/sessions
  // -------------------------------------------------------------------

  async listOwnSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<SessionItem[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return sessions.map((s) => ({
      id: s.id,
      device: this.summarizeUserAgent(s.userAgent),
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt.toISOString(),
      lastSeenAt: s.lastSeenAt ? s.lastSeenAt.toISOString() : null,
      expiresAt: s.expiresAt.toISOString(),
      current: s.id === currentSessionId,
    }));
  }

  // -------------------------------------------------------------------
  // DELETE /auth/me/sessions/:id
  // -------------------------------------------------------------------

  async revokeOwnSession(
    userId: string,
    sessionId: string,
    currentSessionId: string,
    ipAddress?: string | null,
  ): Promise<{ ok: true }> {
    if (sessionId === currentSessionId) {
      throw new BadRequestException(
        'Não é possível encerrar a sessão atual por aqui — use o botão "Sair".',
      );
    }
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, revokedAt: null },
      select: { id: true },
    });
    if (!session) throw new NotFoundException('Sessão não encontrada');

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.SESSION_REVOKED,
      module: 'AUTH',
      resourceId: sessionId,
      meta: { revokedBy: 'self', sessionId },
      ipAddress: ipAddress ?? null,
    });

    return { ok: true };
  }

  // -------------------------------------------------------------------
  // Heuristic device summary — keeps the UI list legible.
  // -------------------------------------------------------------------

  private summarizeUserAgent(ua: string | null): string {
    if (!ua) return 'Navegador desconhecido';
    // CLI / non-browser clients — surface them as-is so the user can
    // recognise an api-call session in their list.
    if (/curl/i.test(ua)) return 'curl (CLI)';
    if (/^node$|node-fetch|axios/i.test(ua)) return 'Node.js (script)';
    if (/postman/i.test(ua)) return 'Postman';
    const browser = /Edg\//.test(ua)
      ? 'Edge'
      : /Chrome\/(?!.*Edg)/.test(ua)
        ? 'Chrome'
        : /Safari\/(?!.*Chrome)/.test(ua)
          ? 'Safari'
          : /Firefox/.test(ua)
            ? 'Firefox'
            : 'Navegador';
    const os = /Windows NT/.test(ua)
      ? 'Windows'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Android/.test(ua)
          ? 'Android'
          : /iPhone|iPad/.test(ua)
            ? 'iOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : null;
    return os ? `${browser} no ${os}` : browser;
  }
}
