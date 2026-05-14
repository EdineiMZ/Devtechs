import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateBillingProductDto,
  UpdateBillingProductDto,
} from './dto/billing-product.dto';

@Injectable()
export class BillingProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(activeOnly = false): Promise<unknown[]> {
    const rows = await this.prisma.billingProduct.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return rows.map(this.serialize);
  }

  async get(id: string): Promise<unknown> {
    const row = await this.prisma.billingProduct.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('BillingProduct not found');
    return this.serialize(row);
  }

  async create(dto: CreateBillingProductDto): Promise<unknown> {
    const existing = await this.prisma.billingProduct.findFirst({
      where: { name: dto.name, isActive: true },
    });
    if (existing) {
      throw new ConflictException(`An active product named "${dto.name}" already exists`);
    }
    const row = await this.prisma.billingProduct.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        unitPrice: dto.unitPrice,
        unit: dto.unit ?? 'mês',
        category: dto.category ?? null,
        isActive: dto.isActive ?? true,
      },
    });
    return this.serialize(row);
  }

  async update(id: string, dto: UpdateBillingProductDto): Promise<unknown> {
    const existing = await this.prisma.billingProduct.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('BillingProduct not found');

    if (dto.name && dto.name !== existing.name) {
      const conflict = await this.prisma.billingProduct.findFirst({
        where: { name: dto.name, isActive: true, id: { not: id } },
      });
      if (conflict) {
        throw new ConflictException(`An active product named "${dto.name}" already exists`);
      }
    }

    const row = await this.prisma.billingProduct.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        unitPrice: dto.unitPrice,
        unit: dto.unit,
        category: dto.category,
        isActive: dto.isActive,
      },
    });
    return this.serialize(row);
  }

  async deactivate(id: string): Promise<{ message: string; id: string }> {
    const existing = await this.prisma.billingProduct.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('BillingProduct not found');
    await this.prisma.billingProduct.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Product deactivated', id };
  }

  private serialize(row: {
    id: string;
    name: string;
    description: string | null;
    unitPrice: { toString(): string };
    unit: string;
    category: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): unknown {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      unitPrice: Number(row.unitPrice),
      unit: row.unit,
      category: row.category,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
