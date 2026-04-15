import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis client used by the auth-service for pub/sub, the permission
 * cache, 2FA temporary secrets, and the login rate-limit counters.
 *
 * DEV TOLERANCE: in development (NODE_ENV !== 'production') the client
 * is configured with `lazyConnect: true` + a soft retry strategy so a
 * missing Redis never brings the whole service down or spams the
 * console. Read/write methods catch connection failures and return
 * null/no-op, which matches the fail-soft expectations the rest of
 * the codebase already has (PermissionGuard, audit writes, etc.).
 *
 * Production still uses the hard retry strategy — a missing Redis
 * in prod is an ops alarm.
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
      retryStrategy: this.devMode
        ? () => null // Don't auto-retry in dev — avoids connect spam
        : undefined,
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
        // Only log the first offline warning, not every reconnect attempt.
        if (!this.warnedOffline) {
          this.logger.warn(
            `Redis unavailable (${err.message}). Running in degraded dev mode — rate-limiting and cache disabled.`,
          );
          this.warnedOffline = true;
        }
      } else {
        this.logger.error(`Redis error: ${err.message}`);
      }
    });

    if (!this.devMode) {
      // In prod, force the initial connect so startup fails fast on
      // a misconfigured deployment. In dev we let lazyConnect defer
      // the first connect until a real command.
      this.client.connect().catch(() => {
        /* error already logged via the 'error' handler */
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client?.quit();
      this.logger.log('Redis disconnected');
    } catch {
      /* already disconnected, nothing to clean up */
    }
  }

  /**
   * Run a Redis command with dev-mode tolerance: if Redis is offline
   * in dev we return `fallback` instead of throwing. In production we
   * let the error propagate so the caller decides.
   */
  private async run<T>(op: () => Promise<T>, fallback: T): Promise<T> {
    if (this.devMode && this.client.status !== 'ready') {
      // Try a lazy connect once; on failure return the fallback.
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
      if (this.devMode) {
        return fallback;
      }
      throw err;
    }
  }

  /**
   * Publish a structured event to a Redis channel. Swallows transport
   * errors so the caller can stay focused on its business logic.
   */
  async publish<T>(channel: string, payload: T): Promise<void> {
    const message = JSON.stringify({
      channel,
      publishedAt: new Date().toISOString(),
      payload,
    });
    await this.run(() => this.client.publish(channel, message).then(() => undefined), undefined);
  }

  async get(key: string): Promise<string | null> {
    return this.run(() => this.client.get(key), null);
  }

  async set(key: string, value: string): Promise<void> {
    await this.run(() => this.client.set(key, value).then(() => undefined), undefined);
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

  async incr(key: string): Promise<number> {
    return this.run(() => this.client.incr(key), 0);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.run(
      () => this.client.expire(key, ttlSeconds).then(() => undefined),
      undefined,
    );
  }

  async ttl(key: string): Promise<number> {
    return this.run(() => this.client.ttl(key), -2);
  }
}
