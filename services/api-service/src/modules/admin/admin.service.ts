import { Injectable, NotFoundException } from '@nestjs/common';
import type { ApiKey, Prisma } from '@szdevs/database';

import { generateApiKey, hashSecret } from '../../common/crypto/key-gen';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type {
  AuditLogQueryDto,
  CreateApiKeyDto,
  RevokeApiKeyDto,
  UpdateApiKeyDto,
} from './dto/admin.dto';

export interface CreateApiKeyResult {
  /** The full key string shown once — not stored in DB. */
  key: string;
  apiKey: ApiKey;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async listKeys(): Promise<ApiKey[]> {
    return this.prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getKey(id: string): Promise<ApiKey & { auditLogs: unknown[] }> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id },
      include: {
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!apiKey) {
      throw new NotFoundException(`API key ${id} not found`);
    }
    return apiKey as ApiKey & { auditLogs: unknown[] };
  }

  async createKey(dto: CreateApiKeyDto): Promise<CreateApiKeyResult> {
    const { fullKey, prefix, secret } = generateApiKey();
    const keyHash = await hashSecret(secret);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        keyPrefix: prefix,
        keyHash,
        permissions: dto.permissions,
        ipBinding: dto.ipBinding,
        boundIps: dto.boundIps ?? [],
        rateLimit: dto.rateLimit as unknown as Prisma.InputJsonValue,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        status: 'ACTIVE',
      },
    });

    // Audit log for key creation
    setImmediate(() => {
      this.prisma.apiKeyAuditLog
        .create({
          data: {
            apiKeyId: apiKey.id,
            event: 'KEY_CREATED',
            meta: { name: apiKey.name, permissions: apiKey.permissions },
          },
        })
        .catch(() => {});
    });

    return { key: fullKey, apiKey };
  }

  async updateKey(id: string, dto: UpdateApiKeyDto): Promise<ApiKey> {
    const existing = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`API key ${id} not found`);
    }

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: {
        name: dto.name,
        ...(dto.permissions !== undefined && { permissions: dto.permissions }),
        ...(dto.ipBinding !== undefined && { ipBinding: dto.ipBinding }),
        ...(dto.boundIps !== undefined && { boundIps: dto.boundIps }),
        ...(dto.rateLimit !== undefined && { rateLimit: dto.rateLimit as unknown as Prisma.InputJsonValue }),
        ...(dto.expiresAt !== undefined && {
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        }),
      },
    });

    // Invalidate any cached state in Redis (rate limit windows are keyed by id,
    // no per-key metadata cache to clear currently, but this is where it would go).
    await this.redis.del(`apikey:${id}`).catch(() => {});

    return updated;
  }

  async revokeKey(id: string, dto: RevokeApiKeyDto): Promise<ApiKey> {
    const existing = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`API key ${id} not found`);
    }

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revokeReason: dto.reason,
      },
    });

    setImmediate(() => {
      this.prisma.apiKeyAuditLog
        .create({
          data: {
            apiKeyId: id,
            event: 'KEY_REVOKED',
            meta: { reason: dto.reason ?? null },
          },
        })
        .catch(() => {});
    });

    return updated;
  }

  async getAuditLogs(
    keyId: string,
    opts: AuditLogQueryDto,
  ): Promise<{ data: unknown[]; total: number; page: number; limit: number }> {
    const existing = await this.prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!existing) {
      throw new NotFoundException(`API key ${keyId} not found`);
    }

    const page = opts.page ?? 1;
    const limit = opts.limit ?? 50;
    const skip = (page - 1) * limit;

    const where = {
      apiKeyId: keyId,
      ...(opts.event ? { event: opts.event } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.apiKeyAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.apiKeyAuditLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getMetrics(keyId: string): Promise<{
    totalRequests: number;
    requestsToday: number;
    requestsByHour: Array<{ hour: string; count: number }>;
  }> {
    const existing = await this.prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!existing) {
      throw new NotFoundException(`API key ${keyId} not found`);
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [requestsToday, recentLogs] = await Promise.all([
      this.prisma.apiKeyAuditLog.count({
        where: {
          apiKeyId: keyId,
          event: 'REQUEST_OK',
          createdAt: { gte: startOfDay },
        },
      }),
      this.prisma.apiKeyAuditLog.findMany({
        where: {
          apiKeyId: keyId,
          event: 'REQUEST_OK',
          createdAt: { gte: last24h },
        },
        select: { createdAt: true },
      }),
    ]);

    // Group requests by hour (last 24h)
    const hourBuckets = new Map<string, number>();
    for (const log of recentLogs) {
      const d = new Date(log.createdAt);
      // Zero out minutes/seconds to get hour bucket
      const hourLabel = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        d.getHours(),
      ).toISOString();
      hourBuckets.set(hourLabel, (hourBuckets.get(hourLabel) ?? 0) + 1);
    }

    const requestsByHour = Array.from(hourBuckets.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return {
      totalRequests: existing.totalRequests,
      requestsToday,
      requestsByHour,
    };
  }
}
