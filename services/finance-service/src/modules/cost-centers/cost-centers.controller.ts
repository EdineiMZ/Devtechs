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
  UseGuards,
} from '@nestjs/common';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';

import {
  CreateCostCenterDto,
  UpdateCostCenterDto,
} from './dto/cost-center.dto';
import { CostCentersService } from './cost-centers.service';

/** Cost center CRUD — every route requires `finance:costs:manage`. */
@Controller('cost-centers')
@UseGuards(PermissionGuard)
@RequirePermission('finance:costs:manage')
export class CostCentersController {
  constructor(private readonly costCenters: CostCentersService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(): Promise<unknown[]> {
    return this.costCenters.list();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  get(@Param('id') id: string): Promise<unknown> {
    return this.costCenters.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCostCenterDto): Promise<unknown> {
    return this.costCenters.create(dto);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCostCenterDto,
  ): Promise<unknown> {
    return this.costCenters.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string): Promise<{ message: string; id: string }> {
    return this.costCenters.remove(id);
  }
}
