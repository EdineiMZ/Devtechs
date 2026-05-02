import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { PrismaService } from '../../prisma/prisma.service';

interface AdminSessionItem {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

/**
 * Admin endpoints for inspecting + revoking another user's sessions.
 *
 * Mounted at `/admin/users/:userId/sessions`. Distinct from the
 * end-user route `/auth/me/sessions` (which would let a user manage
 * only their OWN sessions — that route lives in `auth.controller`
 * and takes the userId from the access token).
 *
 * Permissions:
 *   - `GET`    requires `dev:logs:view`     (audit panel use case)
 *   - `DELETE` requires `auth:users:manage` (lifecycle change)
 */
@Controller('admin/users')
@UseGuards(PermissionGuard)
@SkipThrottle()
export class AdminSessionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':userId/sessions')
  @RequirePermission('dev:logs:view')
  @HttpCode(HttpStatus.OK)
  async list(@Param('userId') userId: string): Promise<AdminSessionItem[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return sessions.map((s) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
    }));
  }

  @Delete(':userId/sessions/:sessionId')
  @RequirePermission('auth:users:manage')
  @HttpCode(HttpStatus.OK)
  async revoke(
    @Param('userId') userId: string,
    @Param('sessionId') sessionId: string,
  ): Promise<{ ok: true }> {
    // Soft-revoke (sets revokedAt) instead of deleting — keeps the row
    // for audit cross-reference. The 404 is intentional when the
    // session doesn't belong to the named user, so this can't be used
    // as an oracle to enumerate other users' session IDs.
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, revokedAt: null },
      select: { id: true },
    });
    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }
}
