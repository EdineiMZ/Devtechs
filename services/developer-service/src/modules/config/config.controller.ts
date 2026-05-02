import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { DeveloperConfigService } from './config.service';
import {
  GmailAuthCallbackDto,
  SaveGmailCredentialsDto,
  SaveSmtpCredentialsDto,
  UpdateApiKeyDto,
  UpdateEmailProviderDto,
  UpdateFeatureFlagDto,
  UpdatePaymentProviderDto,
  UpdateStorageDto,
} from './dto/config.dto';

@Controller('config')
@UseGuards(PermissionGuard)
export class DeveloperConfigController {
  constructor(private readonly config: DeveloperConfigService) {}

  // ── Snapshot ─────────────────────────────────────────────────────────────

  @Get()
  @RequirePermission('dev:config:view')
  snapshot(): Promise<unknown> {
    return this.config.snapshot();
  }

  // ── Payment provider ─────────────────────────────────────────────────────

  @Get('payment-provider')
  @RequirePermission('dev:config:view')
  paymentProvider(): Promise<unknown> {
    return this.config.paymentProviderSnapshot();
  }

  @Put('payment-provider')
  @RequirePermission('dev:config:edit')
  setPaymentProvider(@Body() dto: UpdatePaymentProviderDto): Promise<unknown> {
    return this.config.setPaymentProvider(dto.provider);
  }

  // ── Storage ──────────────────────────────────────────────────────────────

  @Put('storage')
  @RequirePermission('dev:config:edit')
  setStorage(@Body() dto: UpdateStorageDto): Promise<unknown> {
    return this.config.setStorageProvider(dto.provider);
  }

  // ── Feature flags ─────────────────────────────────────────────────────────

  @Get('feature-flags')
  @RequirePermission('dev:config:view')
  listFlags(): Promise<Record<string, boolean>> {
    return this.config.listFeatureFlags();
  }

  @Put('feature-flags/:flag')
  @RequirePermission('dev:config:edit')
  setFlag(
    @Param('flag') flag: string,
    @Body() dto: UpdateFeatureFlagDto,
  ): Promise<unknown> {
    return this.config.setFeatureFlag(flag, dto.enabled);
  }

  // ── API Keys ─────────────────────────────────────────────────────────────

  @Get('api-keys')
  @RequirePermission('dev:config:view')
  listApiKeys(): Promise<unknown> {
    return this.config.getApiKeys();
  }

  @Put('api-keys/:key')
  @RequirePermission('dev:config:edit')
  setApiKey(
    @Param('key') key: string,
    @Body() dto: UpdateApiKeyDto,
  ): Promise<unknown> {
    return this.config.setApiKey(key, dto.value);
  }

  // ── Email provider ────────────────────────────────────────────────────────

  @Get('email-provider')
  @RequirePermission('dev:config:view')
  emailProvider(): Promise<unknown> {
    return this.config.emailProviderSnapshot();
  }

  @Put('email-provider')
  @RequirePermission('dev:config:edit')
  setEmailProvider(@Body() dto: UpdateEmailProviderDto): Promise<unknown> {
    return this.config.setEmailProvider(dto.provider);
  }

  /** Save SMTP credentials to Redis (overrides env vars, no restart needed). */
  @Put('email-provider/smtp/credentials')
  @RequirePermission('dev:config:edit')
  saveSmtpCredentials(@Body() dto: SaveSmtpCredentialsDto): Promise<void> {
    return this.config.saveSmtpCredentials(dto);
  }

  /** Save Gmail OAuth credentials manually (e.g. from a stored refresh token). */
  @Put('email-provider/gmail/credentials')
  @RequirePermission('dev:config:edit')
  saveGmailCredentials(@Body() dto: SaveGmailCredentialsDto): Promise<void> {
    return this.config.saveGmailCredentials(dto);
  }

  /**
   * Returns the Google OAuth2 authorization URL to open in a popup.
   * The frontend calls this, opens the URL, and waits for the callback.
   */
  @Get('email-provider/gmail/auth-url')
  @RequirePermission('dev:config:edit')
  async gmailAuthUrl(@Query('redirectUri') redirectUri: string): Promise<{ url: string }> {
    const url = await this.config.buildGmailAuthUrl(
      redirectUri ?? 'http://localhost:3000/admin/developer/gmail/callback',
    );
    return { url };
  }

  /**
   * Exchange the OAuth code for tokens.
   * Called by the Next.js callback page after the consent flow.
   */
  @Post('email-provider/gmail/callback')
  @RequirePermission('dev:config:edit')
  gmailCallback(@Body() dto: GmailAuthCallbackDto): Promise<{ user: string }> {
    return this.config.exchangeGmailCode(
      dto.code,
      dto.redirectUri ?? 'http://localhost:3000/admin/developer/gmail/callback',
    );
  }
}
