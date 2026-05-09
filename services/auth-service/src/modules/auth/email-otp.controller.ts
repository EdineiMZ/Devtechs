import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { RealIp } from '../../common/decorators/real-ip.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { THROTTLERS } from '../../common/rate-limit/rate-limit.module';

import { EmailOtpService } from './email-otp.service';
import type { LoginSuccessResponse } from './dto/auth-response.dto';
import { RequestEmailOtpDto, VerifyEmailOtpDto } from './dto/email-otp.dto';

@ApiTags('auth')
@Controller('auth/email-otp')
export class EmailOtpController {
  constructor(private readonly emailOtpService: EmailOtpService) {}

  // -------------------------------------------------------------------
  // POST /auth/email-otp/request
  // -------------------------------------------------------------------
  /**
   * Generates a 6-digit one-time code and sends it to the user's email.
   * Always returns 200 (no account enumeration).
   */
  @Public()
  @Throttle({
    [THROTTLERS.DEFAULT]: { limit: 5, ttl: 60_000 },
  })
  @Post('request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a one-time login code via email' })
  @ApiBody({ type: RequestEmailOtpDto })
  @ApiResponse({ status: 200, schema: { example: { message: 'If this email is registered, a login code has been sent.' } } })
  request(@Body() dto: RequestEmailOtpDto): Promise<{ message: string }> {
    return this.emailOtpService.request(dto.email);
  }

  // -------------------------------------------------------------------
  // POST /auth/email-otp/verify
  // -------------------------------------------------------------------
  /**
   * Verifies the 6-digit code and, on success, issues a full session
   * (access + refresh tokens) exactly as a credentials login would.
   */
  @Public()
  @Throttle({
    [THROTTLERS.TWO_FA_VERIFY]: { limit: 10, ttl: 5 * 60_000 },
  })
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify the email OTP and issue session tokens' })
  @ApiBody({ type: VerifyEmailOtpDto })
  @ApiResponse({ status: 200, description: 'OTP accepted — full session tokens issued.' })
  @ApiResponse({ status: 400, description: 'Code expired.' })
  @ApiResponse({ status: 401, description: 'Invalid code.' })
  verify(
    @Body() dto: VerifyEmailOtpDto,
    @RealIp() ip: string,
    @Req() req: Request,
  ): Promise<LoginSuccessResponse> {
    return this.emailOtpService.verify(dto.email, dto.code, {
      ipAddress: ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }
}
