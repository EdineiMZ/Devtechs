import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
@Public()
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  check(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'api-service',
      timestamp: new Date().toISOString(),
    };
  }
}
