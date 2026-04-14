import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Minimal Redis client wrapper used by rh-service's PermissionGuard
 * for caching permission lookups. Keeps the surface tiny (get, set
 * with TTL, del) so the guard doesn't pull in a heavy cache library.
 *
 * Cache operations log errors but never throw — a Redis hiccup must
 * not block authorization. The guard's downstream code treats a
 * failed cache read as a cache miss and goes to the source of truth
 * (the auth-service HTTP call) instead.
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

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async setWithTTL(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Publish a structured event to a Redis pub/sub channel.
   *
   * Used by the vacations module to emit `rh:vacation:approved` and
   * `rh:vacation:rejected` events, which notification-service consumes
   * to dispatch emails. Swallows transport errors and logs them —
   * publishing must never break the user-facing request.
   *
   * Wire format matches the envelope auth-service uses for
   * `notifications:email` so any downstream consumer can handle both
   * producers with identical code:
   *
   *   { channel, publishedAt, payload }
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
}
