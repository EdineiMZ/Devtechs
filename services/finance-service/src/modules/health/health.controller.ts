import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';

/** Liveness probe for the finance-service k8s deployment. */
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  check(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'finance-service',
      timestamp: new Date().toISOString(),
    };
  }
}
