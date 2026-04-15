import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@devtechs/database';

import { PrismaService } from '../../prisma/prisma.service';

import type {
  CreateCostCenterDto,
  UpdateCostCenterDto,
} from './dto/cost-center.dto';

@Injectable()
export class CostCentersService {
  private readonly logger = new Logger(CostCentersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<unknown[]> {
    const rows = await this.prisma.costCenter.findMany({
      orderBy: [{ name: 'asc' }],
      include: {
        project: { select: { id: true, name: true } },
        _count: { select: { transactions: true } },
      },
    });
    return rows.map((r) => this.serialize(r));
  }

  async get(id: string): Promise<unknown> {
    const row = await this.prisma.costCenter.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        _count: { select: { transactions: true } },
      },
    });
    if (!row) throw new NotFoundException('Cost center not found');
    return this.serialize(row);
  }

  async create(dto: CreateCostCenterDto): Promise<unknown> {
    if (dto.projectId) await this.assertProjectExists(dto.projectId);

    const row = await this.prisma.costCenter.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        projectId: dto.projectId ?? null,
        budget: dto.budget ?? null,
      },
      include: {
        project: { select: { id: true, name: true } },
        _count: { select: { transactions: true } },
      },
    });
    this.logger.log(`Created cost center ${row.id} (${row.name})`);
    return this.serialize(row);
  }

  async update(id: string, dto: UpdateCostCenterDto): Promise<unknown> {
    const existing = await this.prisma.costCenter.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Cost center not found');

    if (dto.projectId) await this.assertProjectExists(dto.projectId);

    const data: Prisma.CostCenterUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.budget !== undefined) data.budget = dto.budget;
    if (dto.projectId !== undefined) {
      data.project = dto.projectId
        ? { connect: { id: dto.projectId } }
        : { disconnect: true };
    }

    const row = await this.prisma.costCenter.update({
      where: { id },
      data,
      include: {
        project: { select: { id: true, name: true } },
        _count: { select: { transactions: true } },
      },
    });
    return this.serialize(row);
  }

  async remove(id: string): Promise<{ message: string; id: string }> {
    const existing = await this.prisma.costCenter.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) throw new NotFoundException('Cost center not found');

    await this.prisma.costCenter.delete({ where: { id } });
    this.logger.log(`Deleted cost center ${id} (${existing.name})`);
    return { message: 'Cost center deleted', id };
  }

  private async assertProjectExists(projectId: string): Promise<void> {
    const exists = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!exists) {
      throw new BadRequestException(`Unknown projectId: ${projectId}`);
    }
  }

  private serialize(row: {
    id: string;
    name: string;
    description: string | null;
    projectId: string | null;
    budget: Prisma.Decimal | null;
    createdAt: Date;
    updatedAt: Date;
    project?: { id: string; name: string } | null;
    _count?: { transactions: number };
  }): unknown {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      project: row.project ?? null,
      budget: row.budget ? Number(row.budget) : null,
      transactionCount: row._count?.transactions ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
