import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Minimal Redis client wrapper used by the PermissionGuard cache
 * and by the overdue-sweep job to publish alerts to the
 * notification-service via the `finance:alerts` Pub/Sub channel.
 *
 * Same surface as projects-service / rh-service for the cache
 * primitives. Adds a thin `publish()` for the cross-service
 * notification alert.
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
   * Publish a message on a Redis Pub/Sub channel. Used by the
   * overdue-sweep job to emit alerts consumed by notification-service.
   */
  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }
}
