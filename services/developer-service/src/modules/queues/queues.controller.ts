import {
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { QueuesService } from './queues.service';

@Controller('queues')
@UseGuards(PermissionGuard)
export class QueuesController {
  constructor(private readonly queues: QueuesService) {}

  @Get()
  @RequirePermission('dev:queues:view')
  list(): Promise<unknown[]> {
    return this.queues.list();
  }

  @Get(':name')
  @RequirePermission('dev:queues:view')
  detail(@Param('name') name: string): Promise<unknown> {
    return this.queues.summarize(name);
  }

  @Get(':name/jobs')
  @RequirePermission('dev:queues:view')
  listJobs(
    @Param('name') name: string,
    @Query('status', new DefaultValuePipe('failed'))
    status: 'active' | 'waiting' | 'delayed' | 'failed' | 'completed',
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<unknown[]> {
    return this.queues.listJobs(name, status, limit);
  }

  @Post(':name/jobs/:id/retry')
  @RequirePermission('dev:config:edit')
  retry(
    @Param('name') name: string,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.queues.retryJob(name, id);
  }

  @Delete(':name/jobs/failed')
  @RequirePermission('dev:config:edit')
  cleanFailed(@Param('name') name: string): Promise<unknown> {
    return this.queues.cleanFailed(name);
  }
}
