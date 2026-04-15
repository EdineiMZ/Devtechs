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
  CreateEnvironmentDto,
  HistoryQueryDto,
  UpdateEnvironmentDto,
} from './dto/environment.dto';
import { EnvironmentsService } from './environments.service';

@Controller('environments')
@UseGuards(PermissionGuard)
export class EnvironmentsController {
  constructor(private readonly environments: EnvironmentsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('devops:pipelines:view')
  list(): Promise<unknown[]> {
    return this.environments.list();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('devops:pipelines:view')
  get(@Param('id') id: string): Promise<unknown> {
    return this.environments.get(id);
  }

  @Get(':id/history')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('devops:pipelines:view')
  history(
    @Param('id') id: string,
    @Query() query: HistoryQueryDto,
  ): Promise<unknown[]> {
    return this.environments.history(id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('devops:deploys:trigger')
  create(@Body() dto: CreateEnvironmentDto): Promise<unknown> {
    return this.environments.create(dto);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('devops:deploys:trigger')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEnvironmentDto,
  ): Promise<unknown> {
    return this.environments.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('devops:deploys:trigger')
  remove(@Param('id') id: string): Promise<{ message: string; id: string }> {
    return this.environments.remove(id);
  }
}
