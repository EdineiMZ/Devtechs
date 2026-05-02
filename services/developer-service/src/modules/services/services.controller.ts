import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { ServicesService, type ServiceSummary } from './services.service';

@Controller('services')
@UseGuards(PermissionGuard)
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @RequirePermission('dev:services:view')
  list(@Query('project') project?: string): Promise<ServiceSummary[]> {
    return this.services.list(project);
  }

  @Get(':name')
  @RequirePermission('dev:services:view')
  async detail(@Param('name') name: string): Promise<ServiceSummary> {
    const id = await this.services.findByServiceName(name);
    return this.services.summarize(id);
  }

  @Post(':name/start')
  @RequirePermission('dev:services:restart')
  start(@Param('name') name: string): Promise<{ ok: true; service: string }> {
    return this.services.start(name);
  }

  @Post(':name/stop')
  @RequirePermission('dev:services:stop')
  stop(@Param('name') name: string): Promise<{ ok: true; service: string }> {
    return this.services.stop(name);
  }

  @Post(':name/restart')
  @RequirePermission('dev:services:restart')
  restart(@Param('name') name: string): Promise<{ ok: true; service: string }> {
    return this.services.restart(name);
  }

  @Get(':name/health')
  @RequirePermission('dev:services:view')
  health(@Param('name') name: string): Promise<unknown> {
    return this.services.health(name);
  }
}
