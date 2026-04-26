import { Injectable, Logger } from '@nestjs/common';

import { AuthClientService } from '../../auth-client/auth-client.service';
import { RedisService } from '../../redis/redis.service';

const permissionCacheKey = (userId: string): string =>
  `payments:user:permissions:${userId}`;

const CACHE_TTL_SECONDS = 5 * 60;
const MEMORY_TTL_MS = 30 * 1000;

interface MemoryEntry {
  value: string[];
  expiresAt: number;
}

/**
 * Two-tier permission cache:
 *   1. Process-local Map — 30s TTL, absorbs per-request bursts.
 *   2. Redis — 5min TTL, shared across all service instances.
 * Falls back to auth-service HTTP call on cold start.
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
