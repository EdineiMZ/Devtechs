import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RequireEmailVerified } from '../../common/decorators/require-email-verified.decorator';
import { EmailVerifiedGuard } from '../../common/guards/email-verified.guard';

import {
  AccountService,
  type ChangePasswordResult,
  type ProfileResponse,
  type SessionItem,
} from './account.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * "Account self-service" endpoints — the authenticated caller can:
 *   - PATCH  /auth/me                  update name / avatar
 *   - POST   /auth/me/password         rotate password (logs out
 *                                      every other session)
 *   - GET    /auth/me/sessions         list active sessions
 *   - DELETE /auth/me/sessions/:id     revoke one specific session
 *
 * Distinct from the admin-only equivalents under
 * `/admin/users/:userId/sessions` — these never accept a userId in
 * the body or path, the userId always comes from the access token.
 */
@ApiTags('account')
@Controller('auth/me')
@ApiBearerAuth('bearer')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @UseGuards(EmailVerifiedGuard)
  @RequireEmailVerified()
  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update the caller's name and/or avatar URL" })
  updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateProfileDto,
    @Ip() ip: string,
  ): Promise<ProfileResponse> {
    return this.accountService.updateProfile(user.id, dto, ip);
  }

  @UseGuards(EmailVerifiedGuard)
  @RequireEmailVerified()
  @Post('password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change password',
    description:
      'Verifies the current password, replaces the hash, and revokes ' +
      'every other active session for the user. The current session is ' +
      'preserved so the client can finish the request flow without an ' +
      'immediate 401.',
  })
  changePassword(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ChangePasswordDto,
    @Ip() ip: string,
  ): Promise<ChangePasswordResult> {
    return this.accountService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
      user.sessionId,
      ip,
    );
  }

  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List active sessions for the caller',
    description:
      'Returns at most 50 active (not revoked, not expired) sessions, ' +
      'most recent first. The session matching the bearer token is flagged ' +
      'with `current: true`.',
  })
  listSessions(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<SessionItem[]> {
    return this.accountService.listOwnSessions(user.id, user.sessionId);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific session belonging to the caller' })
  revokeSession(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Ip() ip: string,
  ): Promise<{ ok: true }> {
    return this.accountService.revokeOwnSession(
      user.id,
      id,
      user.sessionId,
      ip,
    );
  }
}
