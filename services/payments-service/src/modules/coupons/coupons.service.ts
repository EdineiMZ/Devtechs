import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { CreateCouponDto } from './dto/coupon.dto';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCouponDto): Promise<unknown> {
    const code = dto.code.toLowerCase().trim();
    const existing = await this.prisma.coupon.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`Coupon code "${code}" already exists`);

    return this.prisma.coupon.create({
      data: { code, discount: dto.discount, type: dto.type, maxUses: dto.maxUses ?? 0, expiresAt: dto.expiresAt ?? null },
    });
  }

  listActive(): Promise<unknown[]> {
    const now = new Date();
    return this.prisma.coupon.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async validate(code: string): Promise<unknown> {
    const now = new Date();
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        code: code.toLowerCase(),
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    if (!coupon) throw new NotFoundException('Coupon not found or expired');
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      throw new ConflictException('Coupon usage limit reached');
    }
    return coupon;
  }
}
