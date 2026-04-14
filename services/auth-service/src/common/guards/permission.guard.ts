import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

import type { CurrentUserPayload } from '../decorators/current-user.decorator';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';

interface RequestWithUser extends Request {
  user?: CurrentUserPayload;
}

/** Role name treated as a super-user who bypasses all permission checks. */
const ADMIN_ROLE = 'admin';

/** TTL for the permission cache — 5 minutes, per spec. */
const PERMISSION_CACHE_TTL_SECONDS = 5 * 60;

const permissionCacheKey = (userId: string): string => `user:permissions:${userId}`;

/**
 * Enforces `@RequirePermission(...)` metadata. Must run AFTER
 * `JwtAuthGuard` so that `request.user` is already populated.
 *
 * Evaluation order:
 *
 *   1. No metadata on the route → pass-through (guard is a no-op).
 *   2. User has `admin` role → allowed, no DB / cache hit.
 *   3. Otherwise, union the user's permissions (role-derived + direct)
 *      and require ALL of the listed keys to be present.
 *
 * The effective permission set is cached in Redis under
 * `user:permissions:<userId>` for 5 minutes. Callers that mutate the
 * user's role/permission assignments (RolesService, PermissionsService)
 * are responsible for deleting this key so the next request rebuilds it.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // Admin super-role bypasses permission checks.
    if (user.roles.includes(ADMIN_ROLE)) return true;

    const owned = await this.loadUserPermissions(user.id);
    const missing = required.filter((key) => !owned.has(key));
    if (missing.length > 0) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'InsufficientPermission',
        message: `Missing required permission(s): ${missing.join(', ')}`,
        missing,
      });
    }
    return true;
  }

  /**
   * Return the union of permission keys the user has, either through
   * role assignments or as extra individual permissions. Cached in Redis.
   */
  private async loadUserPermissions(userId: string): Promise<Set<string>> {
    const cacheKey = permissionCacheKey(userId);

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const keys = JSON.parse(cached) as string[];
        return new Set(keys);
      }
    } catch (err) {
      // Cache failures must not prevent authorization — fall through
      // to the DB path and log so the incident is visible.
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Permission cache read failed for ${userId}: ${reason}`);
    }

    // Fetch the union in a single transaction snapshot so role-derived
    // and direct permissions stay consistent.
    const [rolePermissions, directPermissions] = await this.prisma.$transaction([
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
      ...rolePermissions.map((rp) => rp.permission.key),
      ...directPermissions.map((up) => up.permission.key),
    ]);

    // Best-effort cache write.
    try {
      await this.redis.setWithTTL(
        cacheKey,
        JSON.stringify([...keys]),
        PERMISSION_CACHE_TTL_SECONDS,
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Permission cache write failed for ${userId}: ${reason}`);
    }

    return keys;
  }
}
