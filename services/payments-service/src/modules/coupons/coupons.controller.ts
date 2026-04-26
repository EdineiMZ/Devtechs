import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CreateCouponDto } from './dto/coupon.dto';
import { CouponsService } from './coupons.service';

@Controller('coupons')
@UseGuards(PermissionGuard)
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('payments:coupons:create')
  create(@Body() dto: CreateCouponDto): Promise<unknown> {
    return this.coupons.create(dto);
  }

  @Get()
  @RequirePermission('payments:reports:view')
  listActive(): Promise<unknown[]> {
    return this.coupons.listActive();
  }

  @Get('validate')
  validate(@Query('code') code: string): Promise<unknown> {
    return this.coupons.validate(code);
  }
}
