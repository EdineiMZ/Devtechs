import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

const permissionCacheKey = (userId: string): string => `user:permissions:${userId}`;

/**
 * Thin helper shared by `RolesService` and `PermissionsService` for
 * invalidating the `PermissionGuard` cache when a user's effective
 * permission set changes.
 *
 * - `invalidateUser(userId)` — drop a single user's cache
 * - `invalidateByRole(roleId)` — drop every user currently holding that
 *   role. Used when a role's permissions are edited (which changes
 *   every assigned user's effective set).
 */
@Injectable()
export class PermissionCacheService {
  private readonly logger = new Logger(PermissionCacheService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async invalidateUser(userId: string): Promise<void> {
    try {
      await this.redis.del(permissionCacheKey(userId));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to invalidate permission cache for ${userId}: ${reason}`);
    }
  }

  async invalidateByRole(roleId: string): Promise<void> {
    const members = await this.prisma.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    });
    await Promise.all(members.map((m) => this.invalidateUser(m.userId)));
  }
}
