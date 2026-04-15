import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import jwt from 'jsonwebtoken';
import type { Server, Socket } from 'socket.io';

import type { NotificationItem } from './notification.service';

interface AccessTokenPayload {
  sub: string;
  email: string;
  sid: string;
  typ: 'access';
  exp?: number;
}

/**
 * Socket.io gateway for real-time notification delivery.
 *
 * Auth flow: the client sends its access token either via the
 * `auth` object on the socket.io handshake (preferred) or via the
 * Authorization header on the upgrade request. The gateway
 * verifies the JWT synchronously; failure → disconnect.
 *
 * Rooms: every authenticated socket joins a room named after the
 * user id, so one-to-one push from `pushToUser()` routes to every
 * device the user has open without a lookup table.
 */
@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
  },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly config: ConfigService) {}

  /**
   * `connection` lifecycle: verify the JWT from the handshake,
   * attach `data.userId` to the socket, and drop the socket into
   * its user room. Any failure disconnects the socket with a
   * message the client can read in the `connect_error` handler.
   */
  handleConnection(client: Socket): void {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      this.logger.error('JWT_SECRET missing — refusing all sockets');
      client.disconnect(true);
      return;
    }

    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`Socket ${client.id} rejected: no token`);
      client.emit('error', { message: 'Missing access token' });
      client.disconnect(true);
      return;
    }

    let payload: AccessTokenPayload;
    try {
      payload = jwt.verify(token, secret) as AccessTokenPayload;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Socket ${client.id} rejected: ${reason}`);
      client.emit('error', { message: 'Invalid access token' });
      client.disconnect(true);
      return;
    }

    if (payload.typ !== 'access' || !payload.sub) {
      client.emit('error', { message: 'Invalid token payload' });
      client.disconnect(true);
      return;
    }

    client.data.userId = payload.sub;
    client.data.email = payload.email;
    void client.join(this.roomForUser(payload.sub));
    this.logger.log(
      `Socket ${client.id} connected for user ${payload.sub} (${payload.email})`,
    );
    client.emit('connected', { userId: payload.sub });
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data.userId as string | undefined;
    if (userId) {
      this.logger.log(`Socket ${client.id} disconnected (user ${userId})`);
    }
  }

  // -------------------------------------------------------------------
  // Server → client push
  // -------------------------------------------------------------------

  /**
   * Emit a `notification` event to every socket in the user's
   * room. Called by the BullMQ consumer right after the Prisma
   * write succeeds, so the client sees the row in real time.
   */
  pushToUser(userId: string, notification: NotificationItem): void {
    this.server.to(this.roomForUser(userId)).emit('notification', notification);
  }

  /**
   * Count active sockets for a user. Useful for health dashboards
   * and for skipping sends when nobody's listening.
   */
  async activeSockets(userId: string): Promise<number> {
    const sockets = await this.server.in(this.roomForUser(userId)).fetchSockets();
    return sockets.length;
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  private roomForUser(userId: string): string {
    return `user:${userId}`;
  }

  /**
   * Pull the bearer token from either the socket.io handshake
   * `auth` field (the recommended spot) or the Authorization
   * header (for clients that can only set HTTP headers).
   */
  private extractToken(client: Socket): string | null {
    const handshake = client.handshake as {
      auth?: { token?: string };
      headers?: Record<string, string | string[] | undefined>;
    };
    const fromAuth = handshake.auth?.token;
    if (typeof fromAuth === 'string' && fromAuth.length > 0) {
      return fromAuth.replace(/^Bearer\s+/i, '');
    }
    const rawHeader = handshake.headers?.authorization;
    const authHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.slice(7);
    }
    return null;
  }
}
