import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { CreateProductDto, UpdateProductDto } from './dto/product.dto';

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

  async update(id: string, dto: UpdateProductDto): Promise<unknown> {
    const product = await this.prisma.licensedProduct.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return this.prisma.licensedProduct.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description || null }),
      },
    });
  }
}
