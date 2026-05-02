import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';

import {
  CreatePaymentConditionDto,
  UpdatePaymentConditionDto,
} from './dto/payment-condition.dto';
import { PaymentConditionsService } from './payment-conditions.service';

/**
 * Payment conditions — installment plans with optional interest rates.
 * Staff with `finance:invoices:issue` manage them; anyone authenticated
 * can list active conditions (used by the checkout UI).
 */
@Controller('payment-conditions')
@UseGuards(PermissionGuard)
export class PaymentConditionsController {
  constructor(private readonly service: PaymentConditionsService) {}

  /** List all conditions; pass `?active=true` to return only active ones. */
  @Get()
  @HttpCode(HttpStatus.OK)
  list(@Query('active') active?: string): Promise<unknown[]> {
    return this.service.list(active === 'true');
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  get(@Param('id') id: string): Promise<unknown> {
    return this.service.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('finance:invoices:issue')
  create(@Body() dto: CreatePaymentConditionDto): Promise<unknown> {
    return this.service.create(dto);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('finance:invoices:issue')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentConditionDto,
  ): Promise<unknown> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('finance:invoices:issue')
  remove(@Param('id') id: string): Promise<{ message: string; id: string }> {
    return this.service.remove(id);
  }
}
