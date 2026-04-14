import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditAction } from '../../common/constants/audit-actions';
import { PermissionCacheService } from '../../common/rbac/permission-cache.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import type {
  GrantPermissionResponse,
  PermissionItem,
  PermissionsByModuleResponse,
  RevokePermissionResponse,
} from './dto/permission-response.dto';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cache: PermissionCacheService,
  ) {}

  // -------------------------------------------------------------------
  // GET /auth/permissions/:userId  (internal — called by sibling services)
  // -------------------------------------------------------------------

  /**
   * Returns the full permission key set for a user — the union of
   * role-derived and directly-granted permissions. Used by other
   * NestJS services (rh-service, projects-service, etc.) whose
   * permission guards cache this result in Redis for 5 minutes.
   *
   * Runs as a single `$transaction` so both halves of the union see
   * the same snapshot. The `User` lookup is a separate first step so
   * unknown IDs produce a clean 404 instead of an empty list that
   * the caller might mistake for "no permissions".
   */
  async getUserPermissions(
    userId: string,
  ): Promise<{ userId: string; permissions: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const [rolePerms, directPerms] = await this.prisma.$transaction([
      this.prisma.rolePermission.findMany({
        where: { role: { users: { some: { userId } } } },
        select: { permission: { select: { key: true } } },
      }),
      this.prisma.userPermission.findMany({
        where: { userId },
        select: { permission: { select: { key: true } } },
      }),
    ]);

    const keys = new Set<string>([
      ...rolePerms.map((rp) => rp.permission.key),
      ...directPerms.map((up) => up.permission.key),
    ]);

    return {
      userId: user.id,
      permissions: [...keys].sort(),
    };
  }

  // -------------------------------------------------------------------
  // GET /permissions
  // -------------------------------------------------------------------

  async listGroupedByModule(): Promise<PermissionsByModuleResponse> {
    const rows = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { key: 'asc' }],
    });

    const grouped = new Map<string, PermissionItem[]>();
    for (const row of rows) {
      const list = grouped.get(row.module) ?? [];
      list.push({
        id: row.id,
        key: row.key,
        name: row.name,
        description: row.description,
        module: row.module,
      });
      grouped.set(row.module, list);
    }

    return {
      modules: [...grouped.entries()].map(([module, permissions]) => ({
        module,
        permissions,
      })),
      total: rows.length,
    };
  }

  // -------------------------------------------------------------------
  // POST /permissions/user/:userId
  // -------------------------------------------------------------------

  async grantToUser(
    userId: string,
    permissionId: string,
    actorId: string,
    ipAddress: string | null,
  ): Promise<GrantPermissionResponse> {
    const [user, permission] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, status: true },
      }),
      this.prisma.permission.findUnique({ where: { id: permissionId } }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    if (user.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot grant a permission to an inactive user');
    }
    if (!permission) throw new NotFoundException('Permission not found');

    const existing = await this.prisma.userPermission.findUnique({
      where: { userId_permissionId: { userId, permissionId } },
    });
    if (existing) {
      throw new ConflictException(
        'User already has this permission granted directly',
      );
    }

    const created = await this.prisma.userPermission.create({
      data: { userId, permissionId, assignedBy: actorId },
      select: { assignedAt: true },
    });

    await this.cache.invalidateUser(userId);

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.PERMISSION_GRANTED,
      module: 'AUTH',
      resourceId: permissionId,
      meta: {
        targetUserId: userId,
        targetEmail: user.email,
        permissionKey: permission.key,
      },
      ipAddress,
    });

    return {
      message: `Permission "${permission.key}" granted to user ${user.email}`,
      userId,
      permission: {
        id: permission.id,
        key: permission.key,
        name: permission.name,
        description: permission.description,
        module: permission.module,
      },
      assignedAt: created.assignedAt.toISOString(),
    };
  }

  // -------------------------------------------------------------------
  // DELETE /permissions/user/:userId/:permissionId
  // -------------------------------------------------------------------

  async revokeFromUser(
    userId: string,
    permissionId: string,
    actorId: string,
    ipAddress: string | null,
  ): Promise<RevokePermissionResponse> {
    const existing = await this.prisma.userPermission.findUnique({
      where: { userId_permissionId: { userId, permissionId } },
      include: {
        permission: { select: { key: true } },
        user: { select: { email: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException(
        'User does not have this permission granted directly',
      );
    }

    await this.prisma.userPermission.delete({
      where: { userId_permissionId: { userId, permissionId } },
    });

    await this.cache.invalidateUser(userId);

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.PERMISSION_REVOKED,
      module: 'AUTH',
      resourceId: permissionId,
      meta: {
        targetUserId: userId,
        targetEmail: existing.user.email,
        permissionKey: existing.permission.key,
      },
      ipAddress,
    });

    return {
      message: `Permission "${existing.permission.key}" revoked from user`,
      userId,
      permissionId,
    };
  }
}
