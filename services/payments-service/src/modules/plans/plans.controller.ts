import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import type { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import { PlansService } from './plans.service';

@Controller('plans')
@UseGuards(PermissionGuard)
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  @Public()
  listActive(): Promise<unknown[]> {
    return this.plans.listActive();
  }

  @Post()
  @RequirePermission('payments:plans:manage')
  create(@Body() dto: CreatePlanDto): Promise<unknown> {
    return this.plans.create(dto);
  }

  @Put(':id')
  @RequirePermission('payments:plans:manage')
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto): Promise<unknown> {
    return this.plans.update(id, dto);
  }
}
