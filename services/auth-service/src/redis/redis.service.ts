import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis client used by the auth-service for pub/sub (e.g. emitting
 * `auth.user.registered` events consumed by notification-service).
 *
 * Exposes `publish()` as a thin wrapper that serializes payloads as JSON
 * and logs transport errors rather than bubbling them up — event publishing
 * must never break the user-facing request.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('REDIS_URL');
    const host = this.config.get<string>('REDIS_HOST', 'redis');
    const port = Number(this.config.get<string>('REDIS_PORT', '6379'));

    this.client = url
      ? new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 })
      : new Redis({ host, port, lazyConnect: false, maxRetriesPerRequest: 3 });

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err) =>
      this.logger.error(`Redis error: ${err.message}`),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
    this.logger.log('Redis disconnected');
  }

  /**
   * Publish a structured event to a Redis channel. Swallows transport
   * errors so the caller can stay focused on its business logic.
   */
  async publish<T>(channel: string, payload: T): Promise<void> {
    try {
      const message = JSON.stringify({
        channel,
        publishedAt: new Date().toISOString(),
        payload,
      });
      await this.client.publish(channel, message);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to publish to ${channel}: ${reason}`);
    }
  }

  // -------------------------------------------------------------------
  // Key/value helpers (used for short-lived state like 2FA setup
  // secrets, rate-limit counters, etc.). Errors bubble up here —
  // unlike publish(), these operations are load-bearing for the
  // caller's request, so silent failure would mask bugs.
  // -------------------------------------------------------------------

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.set(key, value);
  }

  async setWithTTL(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** Atomic increment. Creates the key with value 1 if it doesn't exist. */
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /** Set (or refresh) the TTL on an existing key, in seconds. */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  /**
   * Returns the remaining TTL of a key in seconds.
   * -2 if the key does not exist, -1 if it has no associated expire.
   */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }
}
