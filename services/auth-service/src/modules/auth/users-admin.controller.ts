import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { PrismaService } from '../../prisma/prisma.service';

interface UserAdminItem {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  banned: boolean;
  roles: string[];
  createdAt: string;
  lastLoginAt: string | null;
}

interface PaginatedUsers {
  items: UserAdminItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

@ApiTags('users')
@ApiBearerAuth('bearer')
@Controller('users')
@UseGuards(PermissionGuard)
@RequirePermission('auth:users:manage')
export class UsersAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all users (admin)' })
  async listUsers(
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ): Promise<PaginatedUsers> {
    const page = Math.max(1, Number(pageStr ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(pageSizeStr ?? 20)));
    const skip = (page - 1) * pageSize;

    const where = {
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' as const } },
              { name: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(role
        ? {
            roles: {
              some: { role: { name: { equals: role, mode: 'insensitive' as const } } },
            },
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          roles: { include: { role: { select: { name: true } } } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const items: UserAdminItem[] = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      emailVerified: u.emailVerified,
      twoFactorEnabled: u.twoFactorEnabled,
      banned: u.status === 'BANNED',
      roles: u.roles.map((r) => r.role.name),
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    }));

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  @Post(':userId/ban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ban a user' })
  async banUser(@Param('userId') userId: string): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'BANNED' },
    });
    return { message: 'User banned successfully' };
  }

  @Post(':userId/unban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unban a user' })
  async unbanUser(@Param('userId') userId: string): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });
    return { message: 'User unbanned successfully' };
  }

  @Post(':userId/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend (INACTIVE) a user without a full ban' })
  async suspendUser(@Param('userId') userId: string): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'INACTIVE' },
    });
    return { message: 'User suspended successfully' };
  }

  @Post(':userId/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-activate a previously suspended user' })
  async activateUser(@Param('userId') userId: string): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });
    return { message: 'User activated successfully' };
  }

  @Post(':userId/disable-2fa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: disable 2FA for a user (support unlock)' })
  async disable2FA(@Param('userId') userId: string): Promise<{ message: string }> {
    // Clear the 2FA secret, disable the flag, and delete all recovery codes.
    // The user will have to set up 2FA again from scratch if their role requires it.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      }),
      this.prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
    ]);
    return { message: '2FA disabled successfully. User must re-enroll.' };
  }

  @Post(':userId/revoke-sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all active sessions for a user' })
  async revokeSessions(@Param('userId') userId: string): Promise<{ message: string; count: number }> {
    const now = new Date();
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
    return { message: 'Sessions revoked', count: result.count };
  }
}
