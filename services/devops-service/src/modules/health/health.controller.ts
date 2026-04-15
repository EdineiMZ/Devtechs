import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  check(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'devops-service',
      timestamp: new Date().toISOString(),
    };
  }
}
