import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@devtechs/database';

import { AuditAction } from '../../common/constants/audit-actions';
import { PermissionCacheService } from '../../common/rbac/permission-cache.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import type { CreateRoleDto } from './dto/create-role.dto';
import type { QueryRolesDto } from './dto/query-roles.dto';
import type {
  AssignRoleResponse,
  PermissionSummary,
  RoleResponse,
  UnassignRoleResponse,
} from './dto/role-response.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';

/**
 * Prisma include clause that pulls the role together with the
 * attached permissions in a single round-trip. Kept as a named const
 * so every fetch produces the same shape and `toResponse()` can assume
 * the nested keys exist.
 */
const ROLE_WITH_PERMISSIONS = {
  permissions: {
    include: { permission: true },
    orderBy: { permission: { key: 'asc' as const } },
  },
} satisfies Prisma.RoleInclude;

type RoleWithPermissions = Prisma.RoleGetPayload<{
  include: typeof ROLE_WITH_PERMISSIONS;
}>;

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cache: PermissionCacheService,
  ) {}

  // -------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------

  async create(
    dto: CreateRoleDto,
    actorId: string,
    ipAddress: string | null,
  ): Promise<RoleResponse> {
    await this.ensureNameAvailable(dto.name);
    const permissionIds = dto.permissionIds ?? [];
    await this.ensurePermissionsExist(permissionIds);

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        requireEmailVerified: dto.requireEmailVerified ?? false,
        require2FA: dto.require2FA ?? false,
        isSystem: false,
        permissions: {
          create: permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: ROLE_WITH_PERMISSIONS,
    });

    await this.auditService.log({
      userId: actorId,
      action: 'ROLE_CREATED',
      module: 'AUTH',
      resourceId: role.id,
      meta: { name: role.name, permissionCount: permissionIds.length },
      ipAddress,
    });

    return this.toResponse(role);
  }

  // -------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------

  async list(query: QueryRolesDto): Promise<RoleResponse[]> {
    const where: Prisma.RoleWhereInput = {};
    if (query.module) {
      where.permissions = {
        some: {
          permission: {
            module: query.module as Prisma.PermissionWhereInput['module'],
          },
        },
      };
    }

    const roles = await this.prisma.role.findMany({
      where,
      include: ROLE_WITH_PERMISSIONS,
      orderBy: { name: 'asc' },
    });
    return roles.map((r) => this.toResponse(r));
  }

  async get(id: string): Promise<RoleResponse> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: ROLE_WITH_PERMISSIONS,
    });
    if (!role) throw new NotFoundException('Role not found');
    return this.toResponse(role);
  }

  // -------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------

  async update(
    id: string,
    dto: UpdateRoleDto,
    actorId: string,
    ipAddress: string | null,
  ): Promise<RoleResponse> {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Role not found');

    if (existing.isSystem && dto.permissionIds) {
      throw new ForbiddenException(
        'System roles cannot have their permissions edited',
      );
    }

    const data: Prisma.RoleUpdateInput = {};
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.requireEmailVerified !== undefined) {
      data.requireEmailVerified = dto.requireEmailVerified;
    }
    if (dto.require2FA !== undefined) data.require2FA = dto.require2FA;

    if (dto.permissionIds) {
      await this.ensurePermissionsExist(dto.permissionIds);
      // Replace semantics: wipe then recreate. Cleaner than diffing
      // for the expected cardinality (dozens of permissions, not
      // thousands), and the cascade delete handles the RolePermission rows.
      data.permissions = {
        deleteMany: {},
        create: dto.permissionIds.map((permissionId) => ({ permissionId })),
      };
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data,
      include: ROLE_WITH_PERMISSIONS,
    });

    // Any permission change ripples out to every user holding the role.
    if (dto.permissionIds) {
      await this.cache.invalidateByRole(id);
    }

    await this.auditService.log({
      userId: actorId,
      action: 'ROLE_UPDATED',
      module: 'AUTH',
      resourceId: id,
      meta: {
        name: existing.name,
        changedFields: Object.keys(dto),
      },
      ipAddress,
    });

    return this.toResponse(updated);
  }

  // -------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------

  async remove(
    id: string,
    actorId: string,
    ipAddress: string | null,
  ): Promise<void> {
    const existing = await this.prisma.role.findUnique({
      where: { id },
      select: { id: true, name: true, isSystem: true },
    });
    if (!existing) throw new NotFoundException('Role not found');
    if (existing.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted');
    }

    // Capture the list of users who will lose this role so we can
    // invalidate their permission caches after the delete cascades.
    const affectedUsers = await this.prisma.userRole.findMany({
      where: { roleId: id },
      select: { userId: true },
    });

    await this.prisma.role.delete({ where: { id } });
    await Promise.all(affectedUsers.map((u) => this.cache.invalidateUser(u.userId)));

    await this.auditService.log({
      userId: actorId,
      action: 'ROLE_DELETED',
      module: 'AUTH',
      resourceId: id,
      meta: {
        name: existing.name,
        affectedUserCount: affectedUsers.length,
      },
      ipAddress,
    });
  }

  // -------------------------------------------------------------------
  // Assign / Unassign
  // -------------------------------------------------------------------

  async assignToUser(
    roleId: string,
    userId: string,
    actorId: string,
    ipAddress: string | null,
  ): Promise<AssignRoleResponse> {
    const [role, user] = await Promise.all([
      this.prisma.role.findUnique({ where: { id: roleId } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          twoFactorEnabled: true,
          status: true,
        },
      }),
    ]);

    if (!role) throw new NotFoundException('Role not found');
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot assign a role to an inactive user');
    }

    // Gate on the role's flag requirements. These errors are designed
    // to be surfaced directly to the admin UI so it can tell the user
    // exactly what the blocker is.
    if (role.requireEmailVerified && !user.emailVerified) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'EmailNotVerified',
        message: `Role "${role.name}" requires a verified email. The target user has not verified their email address yet.`,
        requirement: 'emailVerified',
      });
    }
    if (role.require2FA && !user.twoFactorEnabled) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'TwoFactorNotEnabled',
        message: `Role "${role.name}" requires two-factor authentication. The target user has not enabled 2FA on their account yet.`,
        requirement: 'twoFactorEnabled',
      });
    }

    const existing = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
    if (existing) {
      throw new ConflictException('Role is already assigned to this user');
    }

    const assignment = await this.prisma.userRole.create({
      data: { userId, roleId, assignedBy: actorId },
      select: { assignedAt: true },
    });

    await this.cache.invalidateUser(userId);

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.ROLE_ASSIGNED,
      module: 'AUTH',
      resourceId: roleId,
      meta: {
        targetUserId: userId,
        targetEmail: user.email,
        roleName: role.name,
      },
      ipAddress,
    });

    return {
      message: `Role "${role.name}" assigned to user ${user.email}`,
      userId,
      roleId,
      assignedAt: assignment.assignedAt.toISOString(),
    };
  }

  async unassignFromUser(
    roleId: string,
    userId: string,
    actorId: string,
    ipAddress: string | null,
  ): Promise<UnassignRoleResponse> {
    const existing = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
      include: { role: { select: { name: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Role is not assigned to this user');
    }

    await this.prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });

    await this.cache.invalidateUser(userId);

    await this.auditService.log({
      userId: actorId,
      action: AuditAction.ROLE_REMOVED,
      module: 'AUTH',
      resourceId: roleId,
      meta: { targetUserId: userId, roleName: existing.role.name },
      ipAddress,
    });

    return {
      message: `Role "${existing.role.name}" removed from user`,
      userId,
      roleId,
    };
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  private async ensureNameAvailable(name: string): Promise<void> {
    const existing = await this.prisma.role.findUnique({
      where: { name },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`Role name "${name}" is already in use`);
    }
  }

  private async ensurePermissionsExist(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const found = await this.prisma.permission.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      const foundIds = new Set(found.map((p) => p.id));
      const missing = ids.filter((id) => !foundIds.has(id));
      throw new BadRequestException({
        statusCode: 400,
        error: 'UnknownPermission',
        message: `Unknown permission id(s): ${missing.join(', ')}`,
        missing,
      });
    }
  }

  private toResponse(role: RoleWithPermissions): RoleResponse {
    const permissions: PermissionSummary[] = role.permissions.map((rp) => ({
      id: rp.permission.id,
      key: rp.permission.key,
      name: rp.permission.name,
      description: rp.permission.description,
      module: rp.permission.module,
    }));
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      requireEmailVerified: role.requireEmailVerified,
      require2FA: role.require2FA,
      permissions,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  }
}
