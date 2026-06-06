import { createHash, randomUUID } from 'crypto';

import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { CreateTokenDto, VerifyTokenDto } from './dto/token.dto';

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  clientId?: string;
  product?: { id: string; name: string; appId: string };
  expiresAt?: string | null;
}

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Generate SHA-256 hex digest of a key. */
  static hashKey(key: string): string {
    return createHash('sha256').update(key, 'utf8').digest('hex');
  }

  async create(
    dto: CreateTokenDto,
    issuedBy: string,
  ): Promise<{ key: string; hash: string; expiresAt: string | null; maxUses: number | null }> {
    // Validate product exists
    const product = await this.prisma.licensedProduct.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    // Validate client binding
    const binding = await this.prisma.clientProductBinding.findUnique({
      where: {
        clientId_productId: {
          clientId: dto.clientId,
          productId: dto.productId,
        },
      },
    });
    if (!binding || binding.revokedAt) {
      throw new UnprocessableEntityException(
        'Client is not bound to this product. Bind first via POST /clients/:id/bind',
      );
    }

    const key = randomUUID();
    const hash = TokensService.hashKey(key);

    const token = await this.prisma.activationToken.create({
      data: {
        key,
        hash,
        clientId: dto.clientId,
        productId: dto.productId,
        maxUses: dto.maxUses ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        hardwareId: dto.hardwareId ?? null,
        issuedBy,
      },
    });

    this.logger.log(
      `Token ${token.id} issued for client ${dto.clientId} product ${product.name}`,
    );

    return {
      key,
      hash,
      expiresAt: token.expiresAt?.toISOString() ?? null,
      maxUses: token.maxUses,
    };
  }

  /** Public verification endpoint — no auth required. */
  async verify(
    dto: VerifyTokenDto,
    ipAddress: string | null,
  ): Promise<VerificationResult> {
    const token = await this.prisma.activationToken.findUnique({
      where: { key: dto.key },
      include: { product: true },
    });

    if (!token) {
      return { valid: false, reason: 'Token not found' };
    }

    // Check product appId matches
    if (token.product.appId !== dto.appId) {
      return { valid: false, reason: 'Token does not belong to this application' };
    }

    // Check status
    if (token.status !== 'ACTIVE') {
      return { valid: false, reason: `Token is ${token.status.toLowerCase()}` };
    }

    // Check expiration
    if (token.expiresAt && token.expiresAt < new Date()) {
      // Auto-expire the token
      await this.prisma.activationToken.update({
        where: { id: token.id },
        data: { status: 'EXPIRED' },
      });
      return { valid: false, reason: 'Token has expired' };
    }

    // Check max uses
    if (token.maxUses !== null && token.usedCount >= token.maxUses) {
      return { valid: false, reason: 'Token usage limit reached' };
    }

    // Check hardware binding
    if (token.hardwareId && dto.hardwareId && token.hardwareId !== dto.hardwareId) {
      return {
        valid: false,
        reason: 'Token is bound to a different hardware',
      };
    }

    // All checks passed — increment usedCount and log activation
    await this.prisma.$transaction([
      this.prisma.activationToken.update({
        where: { id: token.id },
        data: {
          usedCount: { increment: 1 },
          // Bind to hardware on first use if not already bound
          hardwareId: token.hardwareId ?? dto.hardwareId ?? null,
        },
      }),
      this.prisma.tokenActivation.create({
        data: {
          tokenId: token.id,
          hardwareId: dto.hardwareId ?? null,
          appVersion: dto.appVersion ?? null,
          ipAddress,
        },
      }),
    ]);

    // Publish activation event
    await this.redis.publish(
      'license:activated',
      JSON.stringify({
        tokenId: token.id,
        clientId: token.clientId,
        productId: token.productId,
        productName: token.product.name,
        hardwareId: dto.hardwareId ?? token.hardwareId,
        ipAddress,
        activatedAt: new Date().toISOString(),
      }),
    );

    this.logger.log(
      `Token ${token.id} verified for product ${token.product.name}`,
    );

    return {
      valid: true,
      clientId: token.clientId,
      product: {
        id: token.product.id,
        name: token.product.name,
        appId: token.product.appId,
      },
      expiresAt: token.expiresAt?.toISOString() ?? null,
    };
  }

  async revoke(
    tokenId: string,
    revokedBy: string,
    reason?: string,
  ): Promise<unknown> {
    const token = await this.prisma.activationToken.findUnique({
      where: { id: tokenId },
    });
    if (!token) throw new NotFoundException('Token not found');
    if (token.status !== 'ACTIVE') {
      throw new UnprocessableEntityException(
        `Token is already ${token.status.toLowerCase()}`,
      );
    }

    const updated = await this.prisma.activationToken.update({
      where: { id: tokenId },
      data: {
        status: 'REVOKED',
        revokedBy,
        revokedAt: new Date(),
        revokeReason: reason ?? null,
      },
      include: { product: true },
    });

    await this.redis.publish(
      'license:revoked',
      JSON.stringify({
        tokenId: token.id,
        clientId: token.clientId,
        productId: token.productId,
        revokedBy,
        reason: reason ?? null,
        revokedAt: new Date().toISOString(),
      }),
    );

    this.logger.log(`Token ${tokenId} revoked by ${revokedBy}`);
    return updated;
  }

  async listAll(filters?: {
    status?: string;
    clientId?: string;
    productId?: string;
  }): Promise<unknown[]> {
    const where: Record<string, unknown> = {};
    if (filters?.status) where['status'] = filters.status;
    if (filters?.clientId) where['clientId'] = filters.clientId;
    if (filters?.productId) where['productId'] = filters.productId;

    return this.prisma.activationToken.findMany({
      where,
      include: { product: true, activations: { take: 5, orderBy: { activatedAt: 'desc' } } },
      orderBy: { issuedAt: 'desc' },
    });
  }
}
