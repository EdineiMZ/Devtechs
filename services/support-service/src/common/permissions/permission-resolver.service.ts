import { Injectable, Logger } from '@nestjs/common';

import { AuthClientService } from '../../auth-client/auth-client.service';
import { RedisService } from '../../redis/redis.service';

const permissionCacheKey = (userId: string): string =>
  `support:user:permissions:${userId}`;

const CACHE_TTL_SECONDS = 5 * 60;
const MEMORY_TTL_MS = 30 * 1000;

interface MemoryEntry {
  value: string[];
  expiresAt: number;
}

/**
 * Two-tier cache:
 *
 *   1. Process-local Map with a 30s TTL. Absorbs request bursts
 *      inside a single service instance so a page that calls the
 *      resolver five times doesn't hammer auth-service or Redis.
 *
 *   2. Redis-backed distributed cache (5 min). Shared across all
 *      support-service instances. The in-memory layer refreshes
 *      from this on miss, so a fresh pod inherits everyone else's
 *      warm data.
 *
 * Both layers fall back gracefully: if Redis is offline we still
 * get cache hits from memory; if memory is cold we still get hits
 * from Redis. Only the auth-service path is the cold start.
 */
@Injectable()
export class PermissionResolverService {
  private readonly logger = new Logger(PermissionResolverService.name);
  private readonly memory = new Map<string, MemoryEntry>();

  constructor(
    private readonly redis: RedisService,
    private readonly authClient: AuthClientService,
  ) {}

  async getPermissions(userId: string): Promise<Set<string>> {
    // Tier 1 — process memory.
    const mem = this.memory.get(userId);
    if (mem && mem.expiresAt > Date.now()) {
      return new Set(mem.value);
    }

    // Tier 2 — Redis.
    const cacheKey = permissionCacheKey(userId);
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as string[];
        this.memory.set(userId, {
          value: parsed,
          expiresAt: Date.now() + MEMORY_TTL_MS,
        });
        return new Set(parsed);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Permission cache read failed for ${userId}: ${reason}`);
    }

    // Tier 3 — auth-service.
    const permissions = await this.authClient.getPermissions(userId);

    this.memory.set(userId, {
      value: permissions,
      expiresAt: Date.now() + MEMORY_TTL_MS,
    });

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

  async has(userId: string, key: string): Promise<boolean> {
    const owned = await this.getPermissions(userId);
    return owned.has(key);
  }

  async invalidate(userId: string): Promise<void> {
    this.memory.delete(userId);
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
