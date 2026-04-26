import { ConflictException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { CreateProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<unknown[]> {
    return this.prisma.licensedProduct.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateProductDto): Promise<unknown> {
    const existing = await this.prisma.licensedProduct.findUnique({
      where: { appId: dto.appId },
    });
    if (existing) {
      throw new ConflictException(`Product with appId "${dto.appId}" already exists`);
    }

    return this.prisma.licensedProduct.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        appId: dto.appId,
      },
    });
  }
}
