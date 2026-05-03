import { Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { verify } from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import { Subscription } from 'rxjs';

import { AuthClientService } from '../../auth-client/auth-client.service';
import { MonitorEventBus } from './monitor-events.service';
import { MonitorService, type ServiceStatus } from './monitor.service';

interface SocketWithUser extends Socket {
  data: { userId: string };
}

const REQUIRED_PERMISSION = 'dev:logs:view';

@WebSocketGateway({
  namespace: '/monitor',
  cors: { origin: true, credentials: true },
})
export class MonitorGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer() private readonly server!: Server;
  private readonly logger = new Logger(MonitorGateway.name);
  private readonly jwtSecret: string;
  private readonly subs: Subscription[] = [];

  constructor(
    private readonly monitor: MonitorService,
    private readonly events: MonitorEventBus,
    private readonly authClient: AuthClientService,
    config: ConfigService,
  ) {
    this.jwtSecret = config.get<string>('JWT_SECRET') ?? '';
  }

  onModuleInit(): void {
    // Subscribe to all event streams and broadcast to connected clients
    this.subs.push(
      this.events.update$.subscribe((s: ServiceStatus) => {
        this.server?.emit('monitor:update', s);
      }),
      this.events.statusChange$.subscribe((s: ServiceStatus) => {
        this.server?.emit('monitor:statusChange', s);
      }),
      this.events.autoRestarted$.subscribe((e) => {
        this.server?.emit('monitor:autoRestarted', e);
      }),
    );
    this.logger.log('MonitorGateway ready on /monitor namespace');
  }

  // ─── Connection lifecycle ─────────────────────────────────────────────

  async handleConnection(client: SocketWithUser): Promise<void> {
    const token =
      (client.handshake.auth as Record<string, string | undefined>)?.token ??
      (client.handshake.headers as Record<string, string | undefined>)
        ?.authorization?.replace('Bearer ', '');

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = verify(token, this.jwtSecret) as {
        sub?: string;
        userId?: string;
      };
      const userId = String(payload.sub ?? payload.userId ?? '');
      if (!userId) throw new Error('No userId');

      const perms = await this.authClient.getPermissions(userId);
      if (!perms.includes(REQUIRED_PERMISSION)) {
        this.logger.warn(`[${client.id}] ${userId} missing ${REQUIRED_PERMISSION}`);
        client.disconnect(true);
        return;
      }

      client.data = { userId };
      this.logger.log(`[${client.id}] ${userId} connected to /monitor`);

      // Send full snapshot immediately on connect
      client.emit('monitor:status', this.monitor.listStatus());
    } catch (err) {
      this.logger.warn(`[${client.id}] Auth failed: ${String(err)}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: SocketWithUser): void {
    this.logger.log(`[${client.id}] disconnected from /monitor`);
  }

  @SubscribeMessage('monitor:ping')
  handlePing(@ConnectedSocket() client: SocketWithUser): void {
    client.emit('monitor:pong', { ts: new Date().toISOString() });
  }
}
