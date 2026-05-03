import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@szdevs/database';

import { PrismaService } from '../../prisma/prisma.service';
import type { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  /** List all active plans ordered by price ascending. */
  listActive() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  async findById(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return plan;
  }

  create(dto: CreatePlanDto): Promise<unknown> {
    const data: Prisma.PlanCreateInput = {
      name: dto.name,
      description: dto.description ?? null,
      price: dto.price,
      interval: dto.interval,
      features: dto.features ?? [],
      trialDays: dto.trialDays ?? 0,
      isActive: dto.isActive ?? true,
    };
    return this.prisma.plan.create({ data });
  }

  async update(id: string, dto: UpdatePlanDto) {
    await this.findById(id);
    const data: Prisma.PlanUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.interval !== undefined) data.interval = dto.interval;
    if (dto.features !== undefined) data.features = dto.features;
    if (dto.trialDays !== undefined) data.trialDays = dto.trialDays;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.prisma.plan.update({ where: { id }, data });
  }
}
