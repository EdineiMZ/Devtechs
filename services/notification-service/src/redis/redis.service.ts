import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis wrapper for notification-service.
 *
 * The subscriber side (the one that actually listens on channels)
 * gets its OWN ioredis connection in `redis.subscriber.ts` because
 * once a client enters subscribe mode it can't issue regular
 * commands. This service keeps the normal command-mode client for
 * things like publishing telemetry back, set/get, etc.
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

  /** Expose the raw client so the subscriber can `.duplicate()` it. */
  getClient(): Redis {
    return this.client;
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

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return (await this.client.hgetall(key)) ?? {};
    } catch {
      return {};
    }
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hdel(key: string, ...fields: string[]): Promise<void> {
    await this.client.hdel(key, ...fields);
  }

  async publish(channel: string, message: string): Promise<number> {
    try {
      return await this.client.publish(channel, message);
    } catch {
      return 0;
    }
  }
}
