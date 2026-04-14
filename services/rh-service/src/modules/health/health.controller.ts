import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';

interface HealthResponse {
  status: 'ok';
  service: 'rh-service';
  uptime: number;
  timestamp: string;
}

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'rh-service',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
