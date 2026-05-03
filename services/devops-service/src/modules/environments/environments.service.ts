import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@szdevs/database';

import { PrismaService } from '../../prisma/prisma.service';

import type {
  CreateEnvironmentDto,
  HistoryQueryDto,
  UpdateEnvironmentDto,
} from './dto/environment.dto';

export interface EnvironmentProbeResult {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  httpStatus: number | null;
  responseTimeMs: number | null;
  error: string | null;
}

@Injectable()
export class EnvironmentsService {
  private readonly logger = new Logger(EnvironmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<unknown[]> {
    const rows = await this.prisma.environment.findMany({
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: {
        project: { select: { id: true, name: true } },
      },
    });
    return rows.map((r) => this.serialize(r));
  }

  async get(id: string): Promise<unknown> {
    const row = await this.prisma.environment.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true } } },
    });
    if (!row) throw new NotFoundException('Environment not found');
    return this.serialize(row);
  }

  async create(dto: CreateEnvironmentDto): Promise<unknown> {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { id: true },
    });
    if (!project) {
      throw new BadRequestException(`Unknown projectId: ${dto.projectId}`);
    }
    const row = await this.prisma.environment.create({
      data: {
        name: dto.name,
        type: dto.type,
        projectId: dto.projectId,
        url: dto.url,
      },
      include: { project: { select: { id: true, name: true } } },
    });
    this.logger.log(`Created environment ${row.id} (${row.name}/${row.type})`);
    return this.serialize(row);
  }

  async update(id: string, dto: UpdateEnvironmentDto): Promise<unknown> {
    const existing = await this.prisma.environment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Environment not found');

    const data: Prisma.EnvironmentUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.url !== undefined) data.url = dto.url;

    const row = await this.prisma.environment.update({
      where: { id },
      data,
      include: { project: { select: { id: true, name: true } } },
    });
    return this.serialize(row);
  }

  async remove(id: string): Promise<{ message: string; id: string }> {
    const existing = await this.prisma.environment.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) throw new NotFoundException('Environment not found');
    await this.prisma.environment.delete({ where: { id } });
    return { message: 'Environment deleted', id };
  }

  async history(id: string, query: HistoryQueryDto): Promise<unknown[]> {
    const env = await this.prisma.environment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!env) throw new NotFoundException('Environment not found');

    const rows = await this.prisma.environmentHealthCheck.findMany({
      where: { environmentId: id },
      orderBy: { checkedAt: 'desc' },
      take: query.limit ?? 100,
    });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      httpStatus: row.httpStatus,
      responseTimeMs: row.responseTimeMs,
      error: row.error,
      checkedAt: row.checkedAt.toISOString(),
    }));
  }

  /**
   * Persist a probe result: update the Environment's cached
   * status + append a history row. Returns the previous status
   * so the caller (health-check job / gateway) can detect a
   * transition and emit notifications only on change.
   */
  async recordProbe(
    environmentId: string,
    result: EnvironmentProbeResult,
  ): Promise<{ previousStatus: string; currentStatus: string }> {
    const env = await this.prisma.environment.findUnique({
      where: { id: environmentId },
      select: { id: true, status: true },
    });
    if (!env) {
      throw new NotFoundException('Environment not found');
    }

    await this.prisma.$transaction([
      this.prisma.environment.update({
        where: { id: environmentId },
        data: {
          status: result.status,
          lastCheckAt: new Date(),
        },
      }),
      this.prisma.environmentHealthCheck.create({
        data: {
          environmentId,
          status: result.status,
          httpStatus: result.httpStatus,
          responseTimeMs: result.responseTimeMs,
          error: result.error,
        },
      }),
    ]);

    return { previousStatus: env.status, currentStatus: result.status };
  }

  /**
   * Return every environment that's still "tracked" â€” i.e. has
   * a URL. The health-check job iterates over this list on every
   * sweep. Selecting minimal columns keeps the list query index-only.
   */
  async listForProbe(): Promise<
    Array<{ id: string; name: string; url: string }>
  > {
    return this.prisma.environment.findMany({
      where: { url: { not: '' } },
      select: { id: true, name: true, url: true },
    });
  }

  private serialize(row: {
    id: string;
    name: string;
    type: string;
    projectId: string;
    url: string;
    status: string;
    lastCheckAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    project?: { id: string; name: string } | null;
  }): unknown {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      project: row.project ?? { id: row.projectId, name: null },
      url: row.url,
      status: row.status,
      lastCheckAt: row.lastCheckAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
