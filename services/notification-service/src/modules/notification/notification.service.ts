import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@szdevs/database';

import { PrismaService } from '../../prisma/prisma.service';

import type { QueryNotificationsDto } from './dto/query-notifications.dto';

export interface CreateNotificationInput {
  userId: string;
  title: string;
  body: string;
  type: string;
  link?: string | null;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  readAt: string | null;
  link: string | null;
  createdAt: string;
}

/**
 * In-app notification persistence + read-state management.
 * The WebSocket push happens separately in the consumer layer
 * (see `notification.consumer.ts`) so this service stays pure:
 * writes to Postgres, reads from Postgres, no side effects.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput): Promise<NotificationItem> {
    const row = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        body: input.body,
        type: input.type,
        link: input.link ?? null,
      },
    });
    this.logger.log(`Created notification ${row.id} for user ${input.userId} (${input.type})`);
    return this.serialize(row);
  }

  async list(
    userId: string,
    query: QueryNotificationsDto,
  ): Promise<{
    items: NotificationItem[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    unreadCount: number;
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.NotificationWhereInput = { userId };
    if (query.unread === true) where.read = false;

    const [total, rows, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where: { userId, read: false } }),
    ]);

    return {
      items: rows.map((r) => this.serialize(r)),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      unreadCount,
    };
  }

  async markRead(id: string, userId: string): Promise<NotificationItem> {
    // Scoped update: include userId in the where clause so a user
    // can never flip someone else's notifications.
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: { id: true, read: true },
    });
    if (!existing) throw new NotFoundException('Notification not found');
    if (existing.read) {
      // Idempotent â€” just return the current row without hitting UPDATE.
      const row = await this.prisma.notification.findUnique({
        where: { id },
      });
      return this.serialize(row!);
    }

    const row = await this.prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });
    return this.serialize(row);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
    this.logger.log(`Marked ${count} notifications as read for user ${userId}`);
    return { updated: count };
  }

  private serialize(row: {
    id: string;
    userId: string;
    title: string;
    body: string;
    type: string;
    read: boolean;
    readAt: Date | null;
    link: string | null;
    createdAt: Date;
  }): NotificationItem {
    return {
      id: row.id,
      userId: row.userId,
      title: row.title,
      body: row.body,
      type: row.type,
      read: row.read,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      link: row.link,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
