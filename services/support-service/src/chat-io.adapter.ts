import { Logger } from '@nestjs/common';
import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { ServerOptions } from 'socket.io';
import { Server } from 'socket.io';

import { RedisService } from './redis/redis.service';

/**
 * ChatIoAdapter — replaces the default Nest socket.io adapter
 * with one that installs the Redis pub/sub adapter so multi-
 * instance broadcasts work end-to-end.
 *
 * Why we need this: Socket.io's default in-process room
 * registry can't see sockets held by sibling processes. With
 * `@socket.io/redis-adapter`, every server publishes room
 * events over Redis and subscribes to events from the other
 * instances — so `server.to(room).emit(...)` fans out to every
 * socket in that room regardless of which process holds it.
 *
 * DEV TOLERANCE: if Redis is unreachable at adapter-creation
 * time (the `duplicate().connect()` call fails), we fall back
 * to the in-process adapter and log a warning. The service
 * stays up and serves the local instance's sockets correctly;
 * only cross-instance fan-out is disabled. Matches the
 * fail-soft pattern used by RedisService and BullMQ everywhere
 * else in the service.
 */
export class ChatIoAdapter extends IoAdapter {
  private readonly logger = new Logger(ChatIoAdapter.name);
  private redisAdapter: ReturnType<typeof createAdapter> | null = null;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  /**
   * Must be called once during bootstrap, BEFORE Nest wires
   * the gateway providers. Creates the Redis pub/sub pair and
   * keeps the factory for `createIOServer()` to install.
   */
  async connectToRedis(): Promise<void> {
    try {
      const redis = this.app.get(RedisService);
      const pub = redis.getClient().duplicate();
      const sub = redis.getClient().duplicate();

      // `duplicate()` carries the original config — including
      // lazyConnect: true in dev — so we force a connect to
      // surface unreachability now rather than at first emit.
      await Promise.all([
        pub.status === 'ready' ? Promise.resolve() : pub.connect(),
        sub.status === 'ready' ? Promise.resolve() : sub.connect(),
      ]);

      this.redisAdapter = createAdapter(pub, sub);
      this.logger.log('Socket.io Redis adapter connected — multi-instance fan-out enabled');
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Redis adapter unavailable (${reason}). Falling back to in-process broadcasts — cross-instance events are disabled.`,
      );
      this.redisAdapter = null;
    }
  }

  override createIOServer(
    port: number,
    options?: ServerOptions,
  ): Server {
    const server = super.createIOServer(port, options) as Server;
    if (this.redisAdapter) {
      server.adapter(this.redisAdapter);
    }
    return server;
  }
}
