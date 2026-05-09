import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { LogsService, type LogLine } from './logs.service';

@ApiTags('logs')
@Controller('logs')
@UseGuards(PermissionGuard)
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @Get(':service')
  @RequirePermission('dev:logs:view')
  @ApiOperation({ summary: 'Fetch last N log lines for a docker-compose service' })
  getLines(
    @Param('service') service: string,
    @Query('tail', new DefaultValuePipe(200), ParseIntPipe) tail: number,
  ): Promise<LogLine[]> {
    return this.logs.getLines(service, Math.min(tail, 2000));
  }
}
