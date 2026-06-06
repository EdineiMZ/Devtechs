import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { IsBoolean, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { RedisService } from '../../redis/redis.service';

import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { NotificationService } from './notification.service';

// â”€â”€â”€ Preference types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface NotificationPreferences {
  email: {
    invoice:        boolean;
    login:          boolean;
    accountChange:  boolean;
    support:        boolean;
    rh:             boolean;
    system:         boolean;
    subscription:   boolean;
  };
  inapp: {
    invoice:        boolean;
    login:          boolean;
    accountChange:  boolean;
    support:        boolean;
    rh:             boolean;
    system:         boolean;
    subscription:   boolean;
  };
}

class ChannelPrefsDto {
  @IsOptional() @IsBoolean() invoice?:       boolean;
  @IsOptional() @IsBoolean() login?:         boolean;
  @IsOptional() @IsBoolean() accountChange?: boolean;
  @IsOptional() @IsBoolean() support?:       boolean;
  @IsOptional() @IsBoolean() rh?:            boolean;
  @IsOptional() @IsBoolean() system?:        boolean;
  @IsOptional() @IsBoolean() subscription?:  boolean;
}

class UpdatePrefsDto {
  @IsOptional() @IsObject() @ValidateNested() @Type(() => ChannelPrefsDto) email?:  ChannelPrefsDto;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => ChannelPrefsDto) inapp?:  ChannelPrefsDto;
}

const DEFAULTS: Record<string, boolean> = {
  'email.invoice':       true,
  'email.login':         false,
  'email.accountChange': true,
  'email.support':       true,
  'email.rh':            true,
  'email.system':        true,
  'email.subscription':  true,
  'inapp.invoice':       true,
  'inapp.login':         true,
  'inapp.accountChange': true,
  'inapp.support':       true,
  'inapp.rh':            true,
  'inapp.system':        true,
  'inapp.subscription':  true,
};

function prefsKey(userId: string): string {
  return `SZDevs:notif:prefs:${userId}`;
}

function buildPrefsFromHash(hash: Record<string, string>): NotificationPreferences {
  function bool(field: string): boolean {
    if (field in hash) return hash[field] === 'true';
    return DEFAULTS[field] ?? true;
  }
  return {
    email: {
      invoice:       bool('email.invoice'),
      login:         bool('email.login'),
      accountChange: bool('email.accountChange'),
      support:       bool('email.support'),
      rh:            bool('email.rh'),
      system:        bool('email.system'),
      subscription:  bool('email.subscription'),
    },
    inapp: {
      invoice:       bool('inapp.invoice'),
      login:         bool('inapp.login'),
      accountChange: bool('inapp.accountChange'),
      support:       bool('inapp.support'),
      rh:            bool('inapp.rh'),
      system:        bool('inapp.system'),
      subscription:  bool('inapp.subscription'),
    },
  };
}

/**
 * REST endpoints for the authenticated user's own notifications.
 *
 * Every route is scoped to `CurrentUser.id` â€” the service enforces
 * ownership on reads AND writes so a token holder can never touch
 * someone else's inbox.
 */
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notifications: NotificationService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryNotificationsDto,
  ): Promise<unknown> {
    return this.notifications.list(user.id, query);
  }

  @Put('read-all')
  @HttpCode(HttpStatus.OK)
  markAllRead(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ updated: number }> {
    return this.notifications.markAllRead(user.id);
  }

  @Put(':id/read')
  @HttpCode(HttpStatus.OK)
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.notifications.markRead(id, user.id);
  }

  // â”€â”€ Preferences â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Get('preferences')
  @HttpCode(HttpStatus.OK)
  async getPreferences(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<NotificationPreferences> {
    const hash = await this.redis.hgetall(prefsKey(user.id));
    return buildPrefsFromHash(hash);
  }

  @Put('preferences')
  @HttpCode(HttpStatus.OK)
  async updatePreferences(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdatePrefsDto,
  ): Promise<NotificationPreferences> {
    const key = prefsKey(user.id);
    const flat: [string, boolean][] = [];
    if (dto.email) {
      for (const [k, v] of Object.entries(dto.email) as [string, boolean | undefined][]) {
        if (v !== undefined) flat.push([`email.${k}`, v]);
      }
    }
    if (dto.inapp) {
      for (const [k, v] of Object.entries(dto.inapp) as [string, boolean | undefined][]) {
        if (v !== undefined) flat.push([`inapp.${k}`, v]);
      }
    }
    for (const [field, val] of flat) {
      await this.redis.hset(key, field, val ? 'true' : 'false');
    }
    const hash = await this.redis.hgetall(key);
    return buildPrefsFromHash(hash);
  }
}
