import { Injectable, Logger } from '@nestjs/common';

import { AuthClientService } from '../../auth-client/auth-client.service';
import { RedisService } from '../../redis/redis.service';

/** Cache key format — scoped to rh-service. */
const permissionCacheKey = (userId: string): string =>
  `rh:user:permissions:${userId}`;

/** Cache TTL — 5 minutes, matches the spec. */
const CACHE_TTL_SECONDS = 5 * 60;

/**
 * Shared permission resolver used by both the `PermissionGuard`
 * (pre-handler authorization) and services (runtime decisions like
 * "can this user create a vacation for someone else?").
 *
 * Encapsulates the Redis-first, auth-service-fallback lookup pattern
 * so it lives in exactly one place. The guard used to own this logic
 * directly in a private method; extracting it into a service lets
 * feature services call `has()` without re-implementing the cache
 * and without another HTTP round-trip after the guard already primed
 * the cache for the current request.
 *
 * Cache semantics:
 *   - Read failures fall through to the HTTP call and log a warning.
 *   - Write failures are swallowed — the call succeeds, the cache
 *     just doesn't get updated.
 *   - The auth-service HTTP call is the source of truth; any error
 *     there bubbles up to the caller (fail-closed).
 */
@Injectable()
export class PermissionResolverService {
  private readonly logger = new Logger(PermissionResolverService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly authClient: AuthClientService,
  ) {}

  /**
   * Return the user's effective permission set as a `Set<string>`.
   * First call for a user in a given 5-minute window hits the
   * auth-service HTTP endpoint; subsequent calls hit Redis.
   */
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

  /**
   * Convenience: does `userId` hold all of the listed keys?
   * Used by services that need to make runtime branching decisions
   * (e.g. "only managers can create vacations for other employees").
   */
  async hasAll(userId: string, ...keys: string[]): Promise<boolean> {
    const owned = await this.getPermissions(userId);
    return keys.every((key) => owned.has(key));
  }

  /**
   * Convenience: does `userId` hold at least ONE of the listed keys?
   */
  async hasAny(userId: string, ...keys: string[]): Promise<boolean> {
    const owned = await this.getPermissions(userId);
    return keys.some((key) => owned.has(key));
  }

  /**
   * Explicitly drop a cached entry — used after grants/revokes when
   * they happen in-process. Cross-service invalidation goes through
   * a pub/sub channel (future turn).
   */
  async invalidate(userId: string): Promise<void> {
    try {
      await this.redis.del(permissionCacheKey(userId));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Permission cache invalidation failed for ${userId}: ${reason}`);
    }
  }
}
