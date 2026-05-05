import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/public.decorator';
import { THROTTLERS } from '../../common/rate-limit/rate-limit.module';

interface HealthResponse {
  status: 'ok';
  service: 'auth-service';
  uptime: number;
  timestamp: string;
}

// @SkipThrottle() without args defaults to { default: true } and only skips the
// 'default' bucket. Named buckets (register, email-verification, 2fa-verify) still
// run globally and throttle the Docker healthcheck: 127.0.0.1 hits /health every
// 30 s (120 req/h), exceeding the register bucket's 10-req/h limit after ~5 min.
@SkipThrottle({
  [THROTTLERS.DEFAULT]: true,
  [THROTTLERS.REGISTER]: true,
  [THROTTLERS.EMAIL_VERIFICATION]: true,
  [THROTTLERS.TWO_FA_VERIFY]: true,
})
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'auth-service',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
