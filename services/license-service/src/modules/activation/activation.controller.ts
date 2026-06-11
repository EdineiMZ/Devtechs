import { Body, Controller, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { ActivationService, type IssuedKey } from './activation.service';
import { IssueKeyDto, RevokeKeyDto } from './dto/activation.dto';

@ApiTags('activations')
@Controller('activation')
@UseGuards(PermissionGuard)
export class ActivationController {
  constructor(private readonly activation: ActivationService) {}

  @Post('issue')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('licenses:activation:issue')
  @ApiOperation({ summary: 'Issue a JWT RS256 activation key for a customer' })
  issue(
    @Body() dto: IssueKeyDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<IssuedKey> {
    return this.activation.issueKey({
      customerId: dto.customerId,
      modules: dto.modules,
      validityDays: dto.validityDays,
      issuedBy: user.id,
    });
  }

  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('licenses:activation:revoke')
  @ApiOperation({ summary: 'Revoke an activation key' })
  async revoke(
    @Body() dto: RevokeKeyDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ ok: boolean }> {
    await this.activation.revokeKey(dto.keyId, user.id, dto.reason);
    return { ok: true };
  }
}
