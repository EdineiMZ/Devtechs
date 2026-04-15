import { Injectable, Logger } from '@nestjs/common';

import { AuthClientService } from '../../auth-client/auth-client.service';
import { RedisService } from '../../redis/redis.service';

/** Cache key — namespaced to finance-service so it doesn't clash
 *  with the other services on the same Redis instance. */
const permissionCacheKey = (userId: string): string =>
  `finance:user:permissions:${userId}`;

/** TTL — 5 minutes, matches the rest of the platform. */
const CACHE_TTL_SECONDS = 5 * 60;

/**
 * Shared permission resolver — used by `PermissionGuard` (the
 * pre-handler authorization step). Same shape as projects-service
 * and rh-service — duplicated rather than packaged so each service
 * stays deployable on its own.
 */
@Injectable()
export class PermissionResolverService {
  private readonly logger = new Logger(PermissionResolverService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly authClient: AuthClientService,
  ) {}

  async getPermissions(userId: string): Promise<Set<string>> {
    const cacheKey = permissionCacheKey(userId);

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return new Set(JSON.parse(cached) as string[]);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Permission cache read failed for ${userId}: ${reason}`);
    }

    const permissions = await this.authClient.getPermissions(userId);

    try {
      await this.redis.setWithTTL(
        cacheKey,
        JSON.stringify(permissions),
        CACHE_TTL_SECONDS,
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Permission cache write failed for ${userId}: ${reason}`);
    }

    return new Set(permissions);
  }

  async invalidate(userId: string): Promise<void> {
    try {
      await this.redis.del(permissionCacheKey(userId));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Permission cache invalidation failed for ${userId}: ${reason}`,
      );
    }
  }
}
