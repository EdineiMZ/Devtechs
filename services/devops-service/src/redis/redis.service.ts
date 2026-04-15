import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis wrapper for devops-service. Same fail-soft pattern as
 * the rest of the monorepo: dev uses lazyConnect + null retry
 * so a missing Redis degrades gracefully. Exposed methods:
 * `get`, `setWithTTL`, `del`, `publish`, `getClient` (for the
 * Socket.io Redis adapter).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  private readonly devMode: boolean;
  private warnedOffline = false;

  constructor(private readonly config: ConfigService) {
    this.devMode = (process.env.NODE_ENV ?? 'development') !== 'production';
  }

  onModuleInit(): void {
    const url = this.config.get<string>('REDIS_URL');
    const host = this.config.get<string>('REDIS_HOST', 'redis');
    const port = Number(this.config.get<string>('REDIS_PORT', '6379'));

    const commonOptions = {
      maxRetriesPerRequest: this.devMode ? 1 : 3,
      lazyConnect: this.devMode,
      enableOfflineQueue: false,
      connectTimeout: this.devMode ? 2000 : 10_000,
      retryStrategy: this.devMode ? (): null => null : undefined,
    } as const;

    this.client = url
      ? new Redis(url, commonOptions)
      : new Redis({ host, port, ...commonOptions });

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
      this.warnedOffline = false;
    });
    this.client.on('error', (err) => {
      if (this.devMode) {
        if (!this.warnedOffline) {
          this.logger.warn(
            `Redis unavailable (${err.message}). Running in degraded dev mode — cache and pub/sub disabled.`,
          );
          this.warnedOffline = true;
        }
      } else {
        this.logger.error(`Redis error: ${err.message}`);
      }
    });

    if (!this.devMode) {
      this.client.connect().catch(() => {
        /* error already logged via the 'error' handler */
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client?.quit();
    } catch {
      /* already disconnected */
    }
  }

  getClient(): Redis {
    return this.client;
  }

  private async run<T>(op: () => Promise<T>, fallback: T): Promise<T> {
    if (this.devMode && this.client.status !== 'ready') {
      try {
        if (this.client.status === 'wait' || this.client.status === 'end') {
          await this.client.connect();
        }
      } catch {
        return fallback;
      }
    }
    try {
      return await op();
    } catch (err) {
      if (this.devMode) return fallback;
      throw err;
    }
  }

  async get(key: string): Promise<string | null> {
    return this.run(() => this.client.get(key), null);
  }

  async setWithTTL(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.run(
      () => this.client.set(key, value, 'EX', ttlSeconds).then(() => undefined),
      undefined,
    );
  }

  async del(key: string): Promise<void> {
    await this.run(() => this.client.del(key).then(() => undefined), undefined);
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.run(() => this.client.publish(channel, message), 0);
  }
}
