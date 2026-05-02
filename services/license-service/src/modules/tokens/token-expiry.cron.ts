import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

/**
 * Daily job: find tokens expiring within 7 days and publish
 * "license:expiring:soon" events so notification-service can
 * alert the affected clients.
 */
@Injectable()
export class TokenExpiryCron {
  private readonly logger = new Logger(TokenExpiryCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleExpiringSoon(): Promise<void> {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86_400_000);

    try {
      const expiring = await this.prisma.activationToken.findMany({
        where: {
          status: 'ACTIVE',
          expiresAt: {
            gt: now,
            lte: sevenDaysFromNow,
          },
        },
        include: { product: true },
      });

      if (expiring.length === 0) {
        this.logger.debug('No tokens expiring within 7 days');
        return;
      }

      for (const token of expiring) {
        await this.redis.publish(
          'license:expiring:soon',
          JSON.stringify({
            tokenId: token.id,
            clientId: token.clientId,
            productId: token.productId,
            productName: token.product.name,
            expiresAt: token.expiresAt?.toISOString(),
            daysRemaining: Math.ceil(
              (token.expiresAt!.getTime() - now.getTime()) / 86_400_000,
            ),
          }),
        );
      }

      this.logger.log(`Published ${expiring.length} expiring-soon events`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`Token expiry cron failed: ${reason}`);
    }
  }

  /** Also auto-expire tokens that have passed their expiresAt. */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleAutoExpire(): Promise<void> {
    try {
      const result = await this.prisma.activationToken.updateMany({
        where: {
          status: 'ACTIVE',
          expiresAt: { lte: new Date() },
        },
        data: { status: 'EXPIRED' },
      });

      if (result.count > 0) {
        this.logger.log(`Auto-expired ${result.count} tokens`);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`Auto-expire cron failed: ${reason}`);
    }
  }
}
