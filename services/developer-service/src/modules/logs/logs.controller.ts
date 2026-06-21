import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { LogsService } from './logs.service';

@ApiTags('logs')
@ApiBearerAuth('bearer')
@Controller('logs')
@UseGuards(PermissionGuard)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get('containers')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('dev:logs:view')
  @ApiOperation({ summary: 'List all containers available for log retrieval' })
  listContainers() {
    return this.logsService.listContainers();
  }

  @Get('containers/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('dev:logs:view')
  @ApiOperation({ summary: 'Get logs from a specific container' })
  @ApiQuery({ name: 'tail', required: false, type: Number })
  @ApiQuery({ name: 'timestamps', required: false, type: Boolean })
  async getContainerLogs(
    @Param('id') id: string,
    @Query('tail', new DefaultValuePipe(100), ParseIntPipe) tail: number,
    @Query('timestamps') timestamps?: string,
  ) {
    const logs = await this.logsService.getContainerLogs(id, {
      tail,
      timestamps: timestamps === 'true',
    });
    return { containerId: id, logs };
  }
}
