import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import jwt from 'jsonwebtoken';
import type { Server, Socket } from 'socket.io';

import { PermissionResolverService } from '../../common/permissions/permission-resolver.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketsService } from '../tickets/tickets.service';

import { TypingIndicatorService } from './typing-indicator.service';

interface AccessTokenPayload {
  sub: string;
  email: string;
  sid: string;
  typ: 'access';
  exp?: number;
}

/** Shape of `socket.data` on authenticated sockets. */
interface SupportSocketData {
  userId: string;
  email: string;
  displayName: string;
  isAgent: boolean;
  /** Set of ticketIds this socket has successfully joined. */
  joinedTickets: Set<string>;
}

/** Permission that marks a user as a support agent. */
const SUPPORT_AGENT_PERMISSION = 'support:tickets:close';

/**
 * support.gateway.ts — Socket.io real-time channel for ticket
 * conversations.
 *
 * Namespace `/support`. One socket per browser tab; the same
 * user can hold sockets from several tabs and they all receive
 * events independently. Rooms are `ticket:{ticketId}` — a socket
 * only joins a ticket room after `ticket:join` succeeds
 * (calling TicketsService.checkAccess), so pure membership in
 * the namespace doesn't grant access to any ticket's stream.
 *
 * Cross-instance fan-out: main.ts wires the Socket.io Redis
 * adapter so an event emitted from instance A reaches sockets
 * connected to instance B. Rooms, direct emits, and broadcasts
 * all flow through the adapter — the gateway code stays unaware.
 *
 * Internal notes: the gateway respects `isInternal` on the
 * `message:send` event. A non-agent trying to send an internal
 * note gets their message promoted to a normal reply (same
 * pattern as the REST endpoint). When emitting `message:new`,
 * internal notes are pushed as a targeted broadcast to only the
 * agent sockets in the room — client sockets never see them,
 * even if they're theoretically in the same room.
 */
@WebSocketGateway({
  namespace: '/support',
  cors: {
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
  },
})
export class SupportGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SupportGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tickets: TicketsService,
    private readonly typing: TypingIndicatorService,
    private readonly permissions: PermissionResolverService,
  ) {}

  // ===================================================================
  // Connection lifecycle
  // ===================================================================

  async handleConnection(client: Socket): Promise<void> {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      this.logger.error('JWT_SECRET missing — refusing all sockets');
      client.disconnect(true);
      return;
    }

    const token = this.extractToken(client);
    if (!token) {
      this.emitError(client, 'missing-token', 'Missing access token');
      client.disconnect(true);
      return;
    }

    let payload: AccessTokenPayload;
    try {
      payload = jwt.verify(token, secret) as AccessTokenPayload;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.emitError(client, 'invalid-token', `Invalid access token: ${reason}`);
      client.disconnect(true);
      return;
    }

    if (payload.typ !== 'access' || !payload.sub) {
      this.emitError(client, 'bad-token-type', 'Invalid token payload');
      client.disconnect(true);
      return;
    }

    // Resolve the user row once so every subsequent handler has
    // the display name ready without hitting the DB again.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      this.emitError(client, 'inactive-user', 'User is inactive or not found');
      client.disconnect(true);
      return;
    }

    const isAgent = await this.permissions.has(
      user.id,
      SUPPORT_AGENT_PERMISSION,
    );

    const data: SupportSocketData = {
      userId: user.id,
      email: user.email,
      displayName: user.name ?? user.email,
      isAgent,
      joinedTickets: new Set<string>(),
    };
    client.data = data;

    this.logger.log(
      `Socket ${client.id} connected (user=${user.id}, agent=${isAgent})`,
    );
    client.emit('connected', {
      userId: user.id,
      isAgent,
      displayName: data.displayName,
    });
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const data = this.getData(client);
    if (!data) return;

    // Flush typing state for this user on every ticket they were in.
    await this.typing.clearUserEverywhere(data.userId).catch((err) => {
      this.logger.warn(`Failed to flush typing state: ${err?.message}`);
    });

    // Re-broadcast an empty typers list to each room this socket
    // was tracking so the remaining participants see the indicator
    // disappear immediately instead of waiting for the TTL.
    for (const ticketId of data.joinedTickets) {
      const room = this.roomForTicket(ticketId);
      const remaining = await this.typing.currentTypers(ticketId, data.userId);
      this.server.to(room).emit('user:typing', { ticketId, typers: remaining });
    }

    this.logger.log(
      `Socket ${client.id} disconnected (user=${data.userId}, tickets=${data.joinedTickets.size})`,
    );
  }

  // ===================================================================
  // Client → server: ticket:join
  // ===================================================================

  @SubscribeMessage('ticket:join')
  async onTicketJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { ticketId?: string } | null,
  ): Promise<void> {
    const data = this.requireData(client);
    if (!data) return;

    const ticketId = body?.ticketId;
    if (!ticketId) {
      this.emitError(client, 'bad-request', 'ticketId is required');
      return;
    }

    const access = await this.tickets.checkAccess(ticketId, data.userId);
    if (!access.allowed) {
      this.emitError(
        client,
        access.reason,
        access.reason === 'not_found'
          ? 'Ticket not found'
          : 'You do not have access to this ticket',
      );
      return;
    }

    // Refresh the agent flag from the access-check result — it
    // takes into account the same permission cache the REST layer
    // uses, so both paths agree.
    data.isAgent = access.isAgent;

    const room = this.roomForTicket(ticketId);
    await client.join(room);
    data.joinedTickets.add(ticketId);

    this.logger.log(
      `User ${data.userId} joined ${room} (agent=${access.isAgent})`,
    );

    // Send confirmation back to the joining socket.
    client.emit('ticket:joined', {
      ticketId,
      number: access.ticket.number,
      status: access.ticket.status,
    });

    // Broadcast the join to every OTHER socket already in the room
    // (client.to(room) excludes the sender). Only announce agents
    // — a client re-joining their own ticket is noise.
    if (access.isAgent) {
      client.to(room).emit('user:joined', {
        ticketId,
        user: {
          id: data.userId,
          name: data.displayName,
        },
      });
    }
  }

  // ===================================================================
  // Client → server: ticket:leave
  // ===================================================================

  @SubscribeMessage('ticket:leave')
  async onTicketLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { ticketId?: string } | null,
  ): Promise<void> {
    const data = this.requireData(client);
    if (!data) return;

    const ticketId = body?.ticketId;
    if (!ticketId) return;

    const room = this.roomForTicket(ticketId);
    await client.leave(room);
    data.joinedTickets.delete(ticketId);
    await this.typing.stopTyping(ticketId, data.userId);
  }

  // ===================================================================
  // Client → server: message:send
  // ===================================================================

  @SubscribeMessage('message:send')
  async onMessageSend(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { ticketId?: string; body?: string; isInternal?: boolean } | null,
  ): Promise<void> {
    const data = this.requireData(client);
    if (!data) return;

    const ticketId = body?.ticketId;
    const text = (body?.body ?? '').trim();
    if (!ticketId || !text) {
      this.emitError(client, 'bad-request', 'ticketId and body are required');
      return;
    }
    if (text.length > 10_000) {
      this.emitError(client, 'message-too-long', 'Message exceeds 10000 chars');
      return;
    }

    // Gate the room membership — never let a socket push on a
    // ticket it didn't join, even if it somehow has the ticketId.
    if (!data.joinedTickets.has(ticketId)) {
      this.emitError(
        client,
        'not-joined',
        'You must join the ticket room before sending messages',
      );
      return;
    }

    let result;
    try {
      result = await this.tickets.addMessageForGateway({
        ticketId,
        authorId: data.userId,
        body: text,
        isInternal: Boolean(body?.isInternal),
        isAgent: data.isAgent,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.emitError(client, 'persist-failed', reason);
      return;
    }

    // Stop typing as a side effect of sending — the user has
    // clearly stopped typing. Cheaper than waiting for TTL.
    await this.typing.stopTyping(ticketId, data.userId);

    const room = this.roomForTicket(ticketId);

    // Internal notes: broadcast only to agents in the room. We
    // fetch the sockets and filter by the per-socket isAgent flag
    // stored in `socket.data` on connection. Socket.io's
    // `except` / room filtering doesn't support per-socket
    // predicates directly, so we iterate.
    if (result.message.isInternal) {
      const sockets = await this.server.in(room).fetchSockets();
      for (const s of sockets) {
        const sData = s.data as SupportSocketData | undefined;
        if (sData?.isAgent) {
          s.emit('message:new', result.message);
        }
      }
    } else {
      this.server.to(room).emit('message:new', result.message);
    }

    // Clear typers after the broadcast so the recipients see the
    // indicator vanish as the message lands.
    const remaining = await this.typing.currentTypers(ticketId, data.userId);
    this.server.to(room).emit('user:typing', {
      ticketId,
      typers: remaining,
    });

    if (result.statusChanged) {
      this.server.to(room).emit('ticket:status', {
        ticketId,
        from: result.statusChanged.from,
        to: result.statusChanged.to,
      });
    }
  }

  // ===================================================================
  // Client → server: typing:start / typing:stop
  // ===================================================================

  @SubscribeMessage('typing:start')
  async onTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { ticketId?: string } | null,
  ): Promise<void> {
    const data = this.requireData(client);
    if (!data) return;

    const ticketId = body?.ticketId;
    if (!ticketId || !data.joinedTickets.has(ticketId)) return;

    await this.typing.startTyping(ticketId, data.userId, data.displayName);

    const typers = await this.typing.currentTypers(ticketId, data.userId);
    const room = this.roomForTicket(ticketId);
    // Broadcast to OTHERS, so the caller's own typing doesn't
    // bounce back as an indicator on their own screen.
    client.to(room).emit('user:typing', { ticketId, typers: [...typers, { userId: data.userId, name: data.displayName }] });
  }

  @SubscribeMessage('typing:stop')
  async onTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { ticketId?: string } | null,
  ): Promise<void> {
    const data = this.requireData(client);
    if (!data) return;

    const ticketId = body?.ticketId;
    if (!ticketId) return;

    await this.typing.stopTyping(ticketId, data.userId);

    const typers = await this.typing.currentTypers(ticketId, data.userId);
    const room = this.roomForTicket(ticketId);
    client.to(room).emit('user:typing', { ticketId, typers });
  }

  // ===================================================================
  // Server-side emitters — called from the REST layer to push
  // events for state changes that happen outside the socket
  // (e.g. `PUT /tickets/:id/status`, `PUT /tickets/:id/assign`).
  // ===================================================================

  /** Broadcast a status change to everyone in the ticket room. */
  emitStatusChange(ticketId: string, from: string, to: string): void {
    this.server.to(this.roomForTicket(ticketId)).emit('ticket:status', {
      ticketId,
      from,
      to,
    });
  }

  /** Broadcast a "new message from REST" event (e.g. when an
   *  email-to-ticket ingress creates a message). Same filtering
   *  rules as the socket-originated variant. */
  async emitMessageFromRest(
    ticketId: string,
    message: {
      id: string;
      body: string;
      isInternal: boolean;
      author: { id: string; name: string; email: string };
      createdAt: string;
    },
  ): Promise<void> {
    const room = this.roomForTicket(ticketId);
    const payload = { ...message, ticketId };
    if (message.isInternal) {
      const sockets = await this.server.in(room).fetchSockets();
      for (const s of sockets) {
        const sData = s.data as SupportSocketData | undefined;
        if (sData?.isAgent) s.emit('message:new', payload);
      }
    } else {
      this.server.to(room).emit('message:new', payload);
    }
  }

  // ===================================================================
  // Helpers
  // ===================================================================

  private roomForTicket(ticketId: string): string {
    return `ticket:${ticketId}`;
  }

  private getData(client: Socket): SupportSocketData | null {
    return (client.data as SupportSocketData | undefined) ?? null;
  }

  private requireData(client: Socket): SupportSocketData | null {
    const data = this.getData(client);
    if (!data) {
      this.emitError(client, 'not-authenticated', 'Socket is not authenticated');
      client.disconnect(true);
      return null;
    }
    return data;
  }

  private emitError(
    client: Socket,
    code: string,
    message: string,
  ): void {
    this.logger.warn(`Socket ${client.id} error (${code}): ${message}`);
    client.emit('error', { code, message });
  }

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
