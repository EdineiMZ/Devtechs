import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { BindClientDto } from './dto/bind-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async bind(
    clientId: string,
    dto: BindClientDto,
    assignedBy: string,
  ): Promise<unknown> {
    const product = await this.prisma.licensedProduct.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const existing = await this.prisma.clientProductBinding.findUnique({
      where: { clientId_productId: { clientId, productId: dto.productId } },
    });
    if (existing && !existing.revokedAt) {
      throw new ConflictException('Client already bound to this product');
    }

    if (existing?.revokedAt) {
      return this.prisma.clientProductBinding.update({
        where: { id: existing.id },
        data: { revokedAt: null, assignedBy },
      });
    }

    return this.prisma.clientProductBinding.create({
      data: {
        clientId,
        productId: dto.productId,
        assignedBy,
      },
    });
  }

  async listTokens(clientId: string): Promise<unknown[]> {
    return this.prisma.activationToken.findMany({
      where: { clientId },
      include: { product: true, activations: { take: 10, orderBy: { activatedAt: 'desc' } } },
      orderBy: { issuedAt: 'desc' },
    });
  }
}
