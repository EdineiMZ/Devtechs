import {
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('payments')
@UseGuards(PermissionGuard)
export class PaymentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('payments:reports:view')
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<unknown> {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { subscription: { include: { plan: true } } },
      }),
      this.prisma.payment.count(),
    ]);
    return { items, total, page, limit };
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment || payment.userId !== user.id) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }
}
