import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@devtechs/database';

import { PermissionResolverService } from '../../common/permissions/permission-resolver.service';
import { PrismaService } from '../../prisma/prisma.service';

/** Directory where ticket attachments are stored on disk. */
const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads', 'support');

/** Ensure the upload directory exists on startup. */
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

import { addBusinessHours, businessHoursBetween } from './business-hours.util';
import type {
  AssignTicketDto,
  CreateMessageDto,
  CreateTicketDto,
  QueryTicketsDto,
  RateTicketDto,
  TicketStatusLiteral,
  UpdateStatusDto,
} from './dto/ticket.dto';

/** Permission that marks a user as a support agent. Used both to
 *  gate internal-note visibility and to decide whether the caller
 *  can see another user's ticket. */
const SUPPORT_AGENT_PERMISSION = 'support:tickets:close';

type TicketWithRelations = Prisma.TicketGetPayload<{
  include: {
    client: { select: { id: true; name: true; email: true } };
    assignee: { select: { id: true; name: true; email: true } };
    messages: {
      include: {
        author: { select: { id: true; name: true; email: true } };
        attachments: true;
      };
    };
    attachments: true;
  };
}>;

const SUBJECT_TO_CATEGORY: Record<string, string> = {
  orcamento: 'BILLING',
  suporte:   'BUG',
  parceria:  'FEATURE',
  duvida:    'QUESTION',
};

const SUBJECT_LABELS: Record<string, string> = {
  orcamento: 'Orçamento',
  suporte:   'Suporte',
  parceria:  'Parceria',
  duvida:    'Dúvida',
};

const TICKET_INCLUDE = {
  client: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true, email: true } },
  messages: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      author: { select: { id: true, name: true, email: true } },
      attachments: true,
    },
  },
  attachments: true,
} satisfies Prisma.TicketInclude;

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionResolverService,
  ) {}

  // ===================================================================
  // Reads
  // ===================================================================

  async list(
    query: QueryTicketsDto,
    requesterId: string,
  ): Promise<{
    items: unknown[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const isAgent = await this.permissions.has(
      requesterId,
      SUPPORT_AGENT_PERMISSION,
    );

    const where: Prisma.TicketWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.category) where.category = query.category;
    if (query.assigneeId) where.assigneeId = query.assigneeId;
    if (query.clientId) where.clientId = query.clientId;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }
    // Non-agents can only see tickets they opened.
    if (!isAgent) where.clientId = requesterId;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
          _count: { select: { messages: true, attachments: true } },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((r) => this.serializeListItem(r)),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async get(id: string, requesterId: string): Promise<unknown> {
    const ticket = await this.loadOrThrow(id);
    const isAgent = await this.permissions.has(
      requesterId,
      SUPPORT_AGENT_PERMISSION,
    );

    if (!isAgent && ticket.clientId !== requesterId) {
      throw new ForbiddenException('You do not have access to this ticket');
    }

    return this.serializeDetail(ticket, { hideInternal: !isAgent });
  }

  /**
   * Lightweight access check used by the WebSocket gateway when a
   * client tries to join a ticket room. Returns a normalized
   * result instead of throwing so the gateway can emit a typed
   * `error` event instead of a generic exception.
   *
   * Agents (anyone holding `support:tickets:close`) can access any
   * ticket; everyone else can only access tickets they opened.
   */
  async checkAccess(
    ticketId: string,
    userId: string,
  ): Promise<
    | { allowed: false; reason: 'not_found' | 'forbidden' }
    | { allowed: true; isAgent: boolean; ticket: { id: string; number: number; status: string; clientId: string } }
  > {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, number: true, status: true, clientId: true },
    });
    if (!ticket) return { allowed: false, reason: 'not_found' };

    const isAgent = await this.permissions.has(
      userId,
      SUPPORT_AGENT_PERMISSION,
    );
    if (!isAgent && ticket.clientId !== userId) {
      return { allowed: false, reason: 'forbidden' };
    }
    return { allowed: true, isAgent, ticket };
  }

  /**
   * WebSocket-friendly add-message entry point. Same core logic
   * as `addMessage()` but returns the raw Prisma row + the
   * materialized DTO so the gateway can both (a) push the DTO on
   * the socket event and (b) reference the ticket it belongs to.
   *
   * Returns the newly persisted message plus a typed flag for
   * whether the server had to stamp `firstResponseAt` on this
   * message (the caller uses it to emit `ticket:status` on the
   * OPEN → IN_PROGRESS transition that sometimes accompanies
   * the first agent reply).
   */
  async addMessageForGateway(input: {
    ticketId: string;
    authorId: string;
    body: string;
    isInternal: boolean;
    isAgent: boolean;
  }): Promise<{
    message: {
      id: string;
      ticketId: string;
      body: string;
      isInternal: boolean;
      author: { id: string; name: string; email: string };
      createdAt: string;
    };
    statusChanged: null | { from: string; to: string };
    firstResponseStamped: boolean;
  }> {
    const ticket = await this.loadOrThrow(input.ticketId);
    const { authorId, body, isInternal, isAgent } = input;

    // Block messages on finalized tickets.
    if (ticket.status === 'CLOSED') {
      throw new BadRequestException(
        'Não é possível enviar mensagens em chamados finalizados.',
      );
    }

    // Only agents can post internal notes — reject explicitly.
    if (isInternal && !isAgent) {
      throw new ForbiddenException(
        'Apenas agentes de suporte podem enviar notas internas.',
      );
    }
    const effectiveInternal = Boolean(isInternal) && isAgent;

    // Access gate: non-agents can only post on their own tickets.
    if (!isAgent && ticket.clientId !== authorId) {
      throw new ForbiddenException('You can only reply to your own tickets');
    }

    const now = new Date();
    const shouldStampFirstResponse =
      !ticket.firstResponseAt &&
      !effectiveInternal &&
      authorId !== ticket.clientId;

    let previousStatus: TicketStatusLiteral | null = null;
    let nextStatus: TicketStatusLiteral | null = null;

    // A client reply on a WAITING_CLIENT ticket flips it back to
    // IN_PROGRESS so the support queue sees it; capture that so
    // the gateway can emit `ticket:status` on the flip.
    if (ticket.status === 'WAITING_CLIENT' && authorId === ticket.clientId) {
      previousStatus = 'WAITING_CLIENT';
      nextStatus = 'IN_PROGRESS';
    }

    const ticketUpdateData: Prisma.TicketUpdateInput = {};
    if (shouldStampFirstResponse) ticketUpdateData.firstResponseAt = now;
    if (nextStatus) ticketUpdateData.status = nextStatus;

    const [created, updated] = await this.prisma.$transaction([
      this.prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId,
          body,
          isInternal: effectiveInternal,
        },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.ticket.update({
        where: { id: ticket.id },
        data: ticketUpdateData,
        select: { id: true, status: true },
      }),
    ]);

    this.logger.log(
      `Ticket #${ticket.number} gateway message ${created.id} by ${authorId} (internal=${effectiveInternal})`,
    );

    return {
      message: {
        id: created.id,
        ticketId: created.ticketId,
        body: created.body,
        isInternal: created.isInternal,
        author: created.author,
        createdAt: created.createdAt.toISOString(),
      },
      statusChanged: previousStatus && nextStatus
        ? { from: previousStatus, to: updated.status }
        : null,
      firstResponseStamped: shouldStampFirstResponse,
    };
  }

  async listSlaBreach(): Promise<unknown[]> {
    // Tickets whose slaDeadline has passed and that haven't reached
    // RESOLVED/CLOSED yet. Sorted by how much the deadline was
    // missed so support ops can triage the worst first.
    const now = new Date();
    const rows = await this.prisma.ticket.findMany({
      where: {
        slaDeadline: { lt: now },
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
      orderBy: { slaDeadline: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      number: row.number,
      title: row.title,
      status: row.status,
      priority: row.priority,
      client: row.client,
      assignee: row.assignee,
      slaDeadline: row.slaDeadline?.toISOString() ?? null,
      businessHoursOverdue: row.slaDeadline
        ? businessHoursBetween(row.slaDeadline, now)
        : 0,
    }));
  }

  // ===================================================================
  // Writes
  // ===================================================================

  async create(dto: CreateTicketDto, clientId: string): Promise<unknown> {
    const priority = dto.priority ?? 'MEDIUM';
    const policy = await this.prisma.sLAPolicy.findUnique({
      where: { priority },
    });

    const createdAt = new Date();
    // Resolution SLA drives the slaDeadline the report cares about
    // (the first-response budget is typically smaller and tracked
    // via firstResponseAt alone).
    const slaDeadline = policy
      ? addBusinessHours(createdAt, policy.resolutionHours)
      : null;

    const ticket = await this.prisma.ticket.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority,
        category: dto.category ?? 'QUESTION',
        clientId,
        slaDeadline,
        tags: dto.tags ?? [],
      },
      include: TICKET_INCLUDE,
    });

    this.logger.log(
      `Created ticket #${ticket.number} (${ticket.priority}) by ${clientId}`,
    );

    return this.serializeDetail(ticket, { hideInternal: true });
  }

  /**
   * Creates a ticket from the public contact form (no authenticated user).
   * The ticket has no clientId — only guest contact info stored alongside it.
   * Only support agents can view/reply to these tickets.
   */
  async createPublic(input: {
    name: string;
    email: string;
    phone?: string | null;
    subject: string;
    message: string;
  }): Promise<unknown> {
    const category = (SUBJECT_TO_CATEGORY[input.subject] ?? 'QUESTION') as
      | 'BILLING'
      | 'BUG'
      | 'FEATURE'
      | 'QUESTION'
      | 'OTHER';
    const subjectLabel = SUBJECT_LABELS[input.subject] ?? input.subject;
    const priority = 'MEDIUM';

    const policy = await this.prisma.sLAPolicy.findUnique({ where: { priority } });
    const createdAt = new Date();
    const slaDeadline = policy ? addBusinessHours(createdAt, policy.resolutionHours) : null;

    const phone = input.phone?.trim() || null;
    const descriptionLines = [
      `**Nome:** ${input.name}`,
      `**E-mail:** ${input.email}`,
      ...(phone ? [`**Telefone:** ${phone}`] : []),
      `**Assunto:** ${subjectLabel}`,
      '',
      input.message,
    ];

    const ticket = await this.prisma.ticket.create({
      data: {
        title: `[Contato] ${subjectLabel} — ${input.name}`,
        description: descriptionLines.join('\n'),
        priority,
        category,
        clientId: null,
        guestName: input.name,
        guestEmail: input.email,
        guestPhone: phone,
        slaDeadline,
        tags: ['contato-publico', input.subject],
      },
      include: TICKET_INCLUDE,
    });

    this.logger.log(
      `Created public contact ticket #${ticket.number} from ${input.email}`,
    );

    return this.serializeDetail(ticket, { hideInternal: false });
  }

  async assign(
    id: string,
    dto: AssignTicketDto,
    requesterId: string,
  ): Promise<unknown> {
    const ticket = await this.loadOrThrow(id);

    const assignee = await this.prisma.user.findUnique({
      where: { id: dto.assigneeId },
      select: { id: true },
    });
    if (!assignee) {
      throw new BadRequestException(`Unknown assigneeId: ${dto.assigneeId}`);
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        assigneeId: dto.assigneeId,
        // Picking up an OPEN ticket transitions it to IN_PROGRESS.
        status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status,
      },
      include: TICKET_INCLUDE,
    });

    this.logger.log(
      `Ticket #${ticket.number} assigned to ${dto.assigneeId} by ${requesterId}`,
    );
    return this.serializeDetail(updated, { hideInternal: false });
  }

  async updateStatus(
    id: string,
    dto: UpdateStatusDto,
    requesterId: string,
  ): Promise<unknown> {
    const ticket = await this.loadOrThrow(id);
    this.validateStatusTransition(ticket.status, dto.status);

    const data: Prisma.TicketUpdateInput = { status: dto.status };
    if (dto.status === 'RESOLVED' && !ticket.resolvedAt) {
      data.resolvedAt = new Date();
    }
    if (dto.status === 'CLOSED' && !ticket.closedAt) {
      data.closedAt = new Date();
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data,
      include: TICKET_INCLUDE,
    });

    this.logger.log(
      `Ticket #${ticket.number} status ${ticket.status} → ${dto.status} by ${requesterId}`,
    );
    return this.serializeDetail(updated, { hideInternal: false });
  }

  async addMessage(
    id: string,
    dto: CreateMessageDto,
    authorId: string,
  ): Promise<unknown> {
    const ticket = await this.loadOrThrow(id);
    const isAgent = await this.permissions.has(
      authorId,
      SUPPORT_AGENT_PERMISSION,
    );

    // Block messages on finalized tickets.
    if (ticket.status === 'CLOSED') {
      throw new BadRequestException(
        'Não é possível enviar mensagens em chamados finalizados.',
      );
    }

    // Only agents can post internal notes — reject explicitly so the
    // caller knows the flag was recognised and denied.
    if (dto.isInternal && !isAgent) {
      throw new ForbiddenException(
        'Apenas agentes de suporte podem enviar notas internas.',
      );
    }
    const isInternal = Boolean(dto.isInternal) && isAgent;

    // Access gate: non-agents can only post on their own tickets.
    if (!isAgent && ticket.clientId !== authorId) {
      throw new ForbiddenException(
        'You can only reply to your own tickets',
      );
    }

    const now = new Date();
    // `firstResponseAt` is set once, by the FIRST non-client
    // message that isn't an internal note. Non-internal messages
    // from an agent count as the response; internal notes don't.
    const shouldStampFirstResponse =
      !ticket.firstResponseAt &&
      !isInternal &&
      authorId !== ticket.clientId;

    const [, updated] = await this.prisma.$transaction([
      this.prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId,
          body: dto.body,
          isInternal,
        },
      }),
      this.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          firstResponseAt: shouldStampFirstResponse ? now : undefined,
          // A client reply on a WAITING_CLIENT ticket flips it
          // back to IN_PROGRESS so the support queue sees it.
          status:
            ticket.status === 'WAITING_CLIENT' && authorId === ticket.clientId
              ? 'IN_PROGRESS'
              : ticket.status,
        },
        include: TICKET_INCLUDE,
      }),
    ]);

    this.logger.log(
      `Ticket #${ticket.number} new ${isInternal ? 'internal note' : 'message'} by ${authorId}`,
    );

    return this.serializeDetail(updated, { hideInternal: !isAgent });
  }

  async close(id: string, requesterId: string): Promise<unknown> {
    const ticket = await this.loadOrThrow(id);
    if (ticket.status === 'CLOSED') {
      throw new ConflictException('Ticket already closed');
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        resolvedAt: ticket.resolvedAt ?? new Date(),
      },
      include: TICKET_INCLUDE,
    });

    this.logger.log(`Ticket #${ticket.number} closed by ${requesterId}`);
    // CSAT request is emitted to Redis → notification-service will
    // pick it up and send the rating email. Fire-and-forget.
    return this.serializeDetail(updated, { hideInternal: false });
  }

  async rate(
    id: string,
    dto: RateTicketDto,
    requesterId: string,
  ): Promise<unknown> {
    const ticket = await this.loadOrThrow(id);
    if (ticket.clientId !== requesterId) {
      throw new ForbiddenException('Only the ticket client can rate it');
    }
    if (ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED') {
      throw new BadRequestException(
        'Rating is only accepted after the ticket is resolved or closed',
      );
    }
    if (ticket.rating !== null) {
      throw new ConflictException('This ticket has already been rated');
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        rating: dto.rating,
        ratingComment: dto.ratingComment ?? null,
      },
      include: TICKET_INCLUDE,
    });

    this.logger.log(
      `Ticket #${ticket.number} rated ${dto.rating}/5 by ${requesterId}`,
    );
    return this.serializeDetail(updated, { hideInternal: true });
  }

  // ===================================================================
  // Internals
  // ===================================================================

  private async loadOrThrow(id: string): Promise<TicketWithRelations> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: TICKET_INCLUDE,
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  private validateStatusTransition(
    from: TicketStatusLiteral,
    to: TicketStatusLiteral,
  ): void {
    // Simple rule: CLOSED is terminal; everything else is allowed.
    // Prevents an accidental "re-open a closed ticket" via the
    // status endpoint (use a new ticket instead).
    if (from === 'CLOSED' && to !== 'CLOSED') {
      throw new BadRequestException(
        'CLOSED is a terminal state; open a new ticket instead',
      );
    }
  }

  private serializeListItem(row: {
    id: string;
    number: number;
    title: string;
    status: string;
    priority: string;
    category: string;
    clientId: string | null;
    assigneeId: string | null;
    slaDeadline: Date | null;
    firstResponseAt: Date | null;
    resolvedAt: Date | null;
    closedAt: Date | null;
    rating: number | null;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
    guestName: string | null;
    guestEmail: string | null;
    guestPhone: string | null;
    client: { id: string; name: string; email: string } | null;
    assignee: { id: string; name: string; email: string } | null;
    _count: { messages: number; attachments: number };
  }): unknown {
    return {
      id: row.id,
      number: row.number,
      title: row.title,
      status: row.status,
      priority: row.priority,
      category: row.category,
      client: row.client,
      guestName: row.guestName,
      guestEmail: row.guestEmail,
      guestPhone: row.guestPhone,
      assignee: row.assignee,
      slaDeadline: row.slaDeadline?.toISOString() ?? null,
      firstResponseAt: row.firstResponseAt?.toISOString() ?? null,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      closedAt: row.closedAt?.toISOString() ?? null,
      rating: row.rating,
      tags: row.tags,
      messageCount: row._count.messages,
      attachmentCount: row._count.attachments,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ===================================================================
  // Attachments
  // ===================================================================

  async uploadAttachment(
    ticketId: string,
    uploaderId: string,
    file: Express.Multer.File,
    messageId?: string,
  ): Promise<unknown> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, clientId: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const isAgent = await this.permissions.has(uploaderId, SUPPORT_AGENT_PERMISSION);
    if (!isAgent && ticket.clientId !== uploaderId) {
      throw new ForbiddenException('You do not have access to this ticket');
    }

    // Generate a unique storage key and copy the temp file there.
    const ext = path.extname(file.originalname);
    const fileKey = `${ticketId}/${crypto.randomUUID()}${ext}`;
    const destDir = path.join(UPLOAD_DIR, ticketId);
    fs.mkdirSync(destDir, { recursive: true });
    const destPath = path.join(UPLOAD_DIR, fileKey);
    fs.renameSync(file.path, destPath);

    const attachment = await this.prisma.ticketAttachment.create({
      data: {
        ticketId,
        messageId: messageId ?? null,
        fileKey,
        filename: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
      },
    });

    return {
      id: attachment.id,
      ticketId: attachment.ticketId,
      messageId: attachment.messageId,
      filename: attachment.filename,
      size: attachment.size,
      mimeType: attachment.mimeType,
      uploadedAt: attachment.uploadedAt.toISOString(),
    };
  }

  getAttachmentFilePath(
    fileKey: string,
  ): { filePath: string; exists: boolean } {
    const filePath = path.join(UPLOAD_DIR, fileKey);
    const exists = fs.existsSync(filePath);
    return { filePath, exists };
  }

  async getAttachment(
    ticketId: string,
    attachmentId: string,
    requesterId: string,
  ): Promise<{ attachment: { filename: string; mimeType: string; fileKey: string }; filePath: string }> {
    const attachment = await this.prisma.ticketAttachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: { select: { clientId: true } } },
    });
    if (!attachment || attachment.ticketId !== ticketId) {
      throw new NotFoundException('Attachment not found');
    }

    const isAgent = await this.permissions.has(requesterId, SUPPORT_AGENT_PERMISSION);
    if (!isAgent && attachment.ticket.clientId !== requesterId) {
      throw new ForbiddenException('You do not have access to this attachment');
    }

    const { filePath, exists } = this.getAttachmentFilePath(attachment.fileKey);
    if (!exists) throw new NotFoundException('File not found on storage');

    return {
      attachment: {
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        fileKey: attachment.fileKey,
      },
      filePath,
    };
  }

  private serializeDetail(
    row: TicketWithRelations,
    opts: { hideInternal: boolean },
  ): unknown {
    return {
      id: row.id,
      number: row.number,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      category: row.category,
      client: row.client,
      guestName: row.guestName ?? null,
      guestEmail: row.guestEmail ?? null,
      guestPhone: row.guestPhone ?? null,
      assignee: row.assignee,
      slaDeadline: row.slaDeadline?.toISOString() ?? null,
      firstResponseAt: row.firstResponseAt?.toISOString() ?? null,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      closedAt: row.closedAt?.toISOString() ?? null,
      rating: row.rating,
      ratingComment: row.ratingComment,
      tags: row.tags,
      messages: row.messages
        .filter((m) => !(opts.hideInternal && m.isInternal))
        .map((m) => ({
          id: m.id,
          body: m.body,
          isInternal: m.isInternal,
          author: m.author,
          attachments: m.attachments.map((a) => ({
            id: a.id,
            filename: a.filename,
            size: a.size,
            mimeType: a.mimeType,
          })),
          createdAt: m.createdAt.toISOString(),
        })),
      attachments: row.attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        size: a.size,
        mimeType: a.mimeType,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
