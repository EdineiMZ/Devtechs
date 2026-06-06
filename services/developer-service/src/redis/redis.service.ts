import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  private readonly devMode: boolean;
  private warnedOffline = false;

  constructor(private readonly config: ConfigService) {
    this.devMode = (process.env.NODE_ENV ?? 'development') !== 'production';
  }

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('REDIS_URL');
    const host = this.config.get<string>('REDIS_HOST', 'redis');
    const port = Number(this.config.get<string>('REDIS_PORT', '6379'));

    const commonOptions = {
      maxRetriesPerRequest: this.devMode ? 1 : 3,
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
            `Redis unavailable (${err.message}). Degraded dev mode.`,
          );
          this.warnedOffline = true;
        }
      } else {
        this.logger.error(`Redis error: ${err.message}`);
      }
    });

    // In production, block module init until the client is ready. Without
    // this, downstream modules whose onModuleInit issues commands (e.g.
    // MonitorService loading auto-restart flags) hit ioredis while it is
    // still 'connecting' and crash with "Stream isn't writeable" because
    // enableOfflineQueue is false. Dev mode keeps the lazy/non-blocking
    // connect so a missing Redis doesn't block local iteration.
    if (!this.devMode) {
      await new Promise<void>((resolve) => {
        if (this.client.status === 'ready') return resolve();
        const onReady = (): void => {
          this.client.off('error', onError);
          resolve();
        };
        const onError = (): void => {
          // Errors during initial connect are already logged by the
          // 'error' handler above; resolve so the service still boots
          // and downstream `run()` calls degrade per command.
          this.client.off('ready', onReady);
          resolve();
        };
        this.client.once('ready', onReady);
        this.client.once('error', onError);
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client?.quit();
    } catch { /* teardown — ignore quit errors */ }
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

  async set(key: string, value: string): Promise<void> {
    await this.run(() => this.client.set(key, value).then(() => undefined), undefined);
  }

  async del(key: string): Promise<void> {
    await this.run(() => this.client.del(key).then(() => undefined), undefined);
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.run(() => this.client.publish(channel, message), 0);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.run(() => this.client.hgetall(key), {});
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.run(() => this.client.hset(key, field, value).then(() => undefined), undefined);
  }
}
