import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { MonitorService, type ServiceStatus } from './monitor.service';

class SetAutoRestartDto {
  @IsBoolean()
  enabled!: boolean;
}

@ApiTags('monitor')
@ApiBearerAuth('bearer')
@Controller('monitor')
@UseGuards(PermissionGuard)
export class MonitorController {
  constructor(private readonly monitor: MonitorService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('dev:logs:view')
  @ApiOperation({ summary: 'List real-time status of all microservices' })
  list(): ServiceStatus[] {
    return this.monitor.listStatus();
  }

  @Get(':name')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('dev:logs:view')
  @ApiOperation({ summary: 'Get status of a single service' })
  getOne(@Param('name') name: string): ServiceStatus {
    const status = this.monitor.getStatus(name);
    if (!status) throw new NotFoundException(`Serviço não encontrado: ${name}`);
    return status;
  }

  @Post(':name/restart')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('dev:services:restart')
  @ApiOperation({ summary: 'Restart a service container (requires Docker)' })
  restart(
    @Param('name') name: string,
  ): Promise<{ ok: boolean; message: string }> {
    this.requireKnown(name);
    return this.monitor.restartService(name);
  }

  @Post(':name/stop')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('dev:services:stop')
  @ApiOperation({ summary: 'Stop a service container (requires Docker)' })
  stop(
    @Param('name') name: string,
  ): Promise<{ ok: boolean; message: string }> {
    this.requireKnown(name);
    return this.monitor.stopService(name);
  }

  @Post(':name/start')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('dev:services:restart')
  @ApiOperation({ summary: 'Start a service container (requires Docker)' })
  start(
    @Param('name') name: string,
  ): Promise<{ ok: boolean; message: string }> {
    this.requireKnown(name);
    return this.monitor.startService(name);
  }

  @Put(':name/auto-restart')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('dev:services:restart')
  @ApiOperation({ summary: 'Enable or disable auto-restart for a service' })
  setAutoRestart(
    @Param('name') name: string,
    @Body() dto: SetAutoRestartDto,
  ): Promise<ServiceStatus> {
    this.requireKnown(name);
    return this.monitor.setAutoRestart(name, dto.enabled);
  }

  private requireKnown(name: string): void {
    if (!this.monitor.getStatus(name)) {
      throw new NotFoundException(`Serviço não encontrado: ${name}`);
    }
  }
}
