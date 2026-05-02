import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreatePaymentConditionDto,
  UpdatePaymentConditionDto,
} from './dto/payment-condition.dto';

@Injectable()
export class PaymentConditionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(activeOnly = false): Promise<unknown[]> {
    const rows = await this.prisma.paymentCondition.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { installments: 'asc' },
    });
    return rows.map(this.serialize);
  }

  async get(id: string): Promise<unknown> {
    const row = await this.prisma.paymentCondition.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('PaymentCondition not found');
    return this.serialize(row);
  }

  async create(dto: CreatePaymentConditionDto): Promise<unknown> {
    const existing = await this.prisma.paymentCondition.findUnique({
      where: { installments: dto.installments },
    });
    if (existing) {
      throw new ConflictException(
        `A condition for ${dto.installments} installment(s) already exists`,
      );
    }
    const row = await this.prisma.paymentCondition.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        installments: dto.installments,
        interestRate: dto.interestRate,
        active: dto.active ?? true,
      },
    });
    return this.serialize(row);
  }

  async update(id: string, dto: UpdatePaymentConditionDto): Promise<unknown> {
    const existing = await this.prisma.paymentCondition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('PaymentCondition not found');

    if (dto.installments !== undefined && dto.installments !== existing.installments) {
      const conflict = await this.prisma.paymentCondition.findUnique({
        where: { installments: dto.installments },
      });
      if (conflict) {
        throw new ConflictException(
          `A condition for ${dto.installments} installment(s) already exists`,
        );
      }
    }

    const row = await this.prisma.paymentCondition.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        installments: dto.installments,
        interestRate: dto.interestRate,
        active: dto.active,
      },
    });
    return this.serialize(row);
  }

  async remove(id: string): Promise<{ message: string; id: string }> {
    const existing = await this.prisma.paymentCondition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('PaymentCondition not found');
    await this.prisma.paymentCondition.delete({ where: { id } });
    return { message: 'PaymentCondition deleted', id };
  }

  private serialize(row: {
    id: string;
    name: string;
    description: string | null;
    installments: number;
    interestRate: { toString(): string };
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): unknown {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      installments: row.installments,
      interestRate: Number(row.interestRate),
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
