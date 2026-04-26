import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CreateTokenDto, RevokeTokenDto, VerifyTokenDto } from './dto/token.dto';
import { TokensService, type VerificationResult } from './tokens.service';

@Controller('tokens')
@UseGuards(PermissionGuard)
export class TokensController {
  constructor(private readonly tokens: TokensService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('licenses:tokens:generate')
  create(
    @Body() dto: CreateTokenDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ key: string; hash: string; expiresAt: string | null; maxUses: number | null }> {
    return this.tokens.create(dto, user.id);
  }

  @Post('verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  verify(
    @Body() dto: VerifyTokenDto,
    @Req() req: Request,
  ): Promise<VerificationResult> {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      null;
    return this.tokens.verify(dto, ip);
  }

  @Put(':id/revoke')
  @RequirePermission('licenses:tokens:revoke')
  revoke(
    @Param('id') id: string,
    @Body() dto: RevokeTokenDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.tokens.revoke(id, user.id, dto.reason);
  }

  @Get()
  @RequirePermission('licenses:audit:view')
  list(
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
    @Query('productId') productId?: string,
  ): Promise<unknown[]> {
    return this.tokens.listAll({ status, clientId, productId });
  }
}
