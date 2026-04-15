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

interface AccessTokenPayload {
  sub: string;
  email: string;
  sid: string;
  typ: 'access';
  exp?: number;
}

/**
 * /devops — Socket.io namespace for live pipeline + environment
 * updates. Clients connect with their JWT (via handshake auth
 * or Authorization header), and the gateway pushes two event
 * streams:
 *
 *   - `pipeline:update`   — fired every time a Pipeline row
 *                           changes state (triggered by the
 *                           webhook handler or the REST trigger).
 *
 *   - `environment:status` — fired every time an Environment
 *                            row's `status` column changes
 *                            (triggered by the health-check job).
 *
 * Rooms: none today — both events go to everyone in the
 * namespace. A future enhancement can scope rooms by projectId
 * so each workspace only sees its own events.
 */
@WebSocketGateway({
  namespace: '/devops',
  cors: {
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
  },
})
export class PipelinesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PipelinesGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly config: ConfigService) {}

  handleConnection(client: Socket): void {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      client.disconnect(true);
      return;
    }

    const token = this.extractToken(client);
    if (!token) {
      client.emit('error', { code: 'missing-token', message: 'Missing access token' });
      client.disconnect(true);
      return;
    }

    let payload: AccessTokenPayload;
    try {
      payload = jwt.verify(token, secret) as AccessTokenPayload;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      client.emit('error', { code: 'invalid-token', message: reason });
      client.disconnect(true);
      return;
    }

    if (payload.typ !== 'access' || !payload.sub) {
      client.emit('error', { code: 'bad-token-type', message: 'Invalid token payload' });
      client.disconnect(true);
      return;
    }

    client.data = { userId: payload.sub, email: payload.email };
    this.logger.log(`Socket ${client.id} connected (user=${payload.sub})`);
    client.emit('connected', { userId: payload.sub });
  }

  handleDisconnect(client: Socket): void {
    const data = client.data as { userId?: string } | undefined;
    if (data?.userId) {
      this.logger.log(`Socket ${client.id} disconnected (user=${data.userId})`);
    }
  }

  // -------------------------------------------------------------------
  // Server-side emitters
  // -------------------------------------------------------------------

  /** Broadcast a pipeline state change to every /devops client. */
  emitPipelineUpdate(pipelineId: string, status: string): void {
    this.server.emit('pipeline:update', { pipelineId, status });
  }

  /** Broadcast an environment status change to every /devops client. */
  emitEnvironmentStatus(
    environmentId: string,
    from: string,
    to: string,
  ): void {
    this.server.emit('environment:status', {
      environmentId,
      from,
      to,
      occurredAt: new Date().toISOString(),
    });
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  private extractToken(client: Socket): string | null {
    const handshake = client.handshake as {
      auth?: { token?: string };
      query?: { token?: string | string[] };
      headers?: Record<string, string | string[] | undefined>;
    };
    const fromAuth = handshake.auth?.token;
    if (typeof fromAuth === 'string' && fromAuth.length > 0) {
      return fromAuth.replace(/^Bearer\s+/i, '');
    }
    const qp = handshake.query?.token;
    const queryToken = Array.isArray(qp) ? qp[0] : qp;
    if (typeof queryToken === 'string' && queryToken.length > 0) {
      return queryToken.replace(/^Bearer\s+/i, '');
    }
    const rawHeader = handshake.headers?.authorization;
    const authHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.slice(7);
    }
    return null;
  }
}
