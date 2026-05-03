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
import { IsBoolean, IsOptional } from 'class-validator';

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
  };
  inapp: {
    invoice:        boolean;
    login:          boolean;
    accountChange:  boolean;
    support:        boolean;
    rh:             boolean;
    system:         boolean;
  };
}

class UpdatePrefsDto {
  @IsOptional() @IsBoolean() 'email.invoice'?:       boolean;
  @IsOptional() @IsBoolean() 'email.login'?:         boolean;
  @IsOptional() @IsBoolean() 'email.accountChange'?: boolean;
  @IsOptional() @IsBoolean() 'email.support'?:       boolean;
  @IsOptional() @IsBoolean() 'email.rh'?:            boolean;
  @IsOptional() @IsBoolean() 'email.system'?:        boolean;
  @IsOptional() @IsBoolean() 'inapp.invoice'?:       boolean;
  @IsOptional() @IsBoolean() 'inapp.login'?:         boolean;
  @IsOptional() @IsBoolean() 'inapp.accountChange'?: boolean;
  @IsOptional() @IsBoolean() 'inapp.support'?:       boolean;
  @IsOptional() @IsBoolean() 'inapp.rh'?:            boolean;
  @IsOptional() @IsBoolean() 'inapp.system'?:        boolean;
}

const DEFAULTS: Record<string, boolean> = {
  'email.invoice':       true,
  'email.login':         false,
  'email.accountChange': true,
  'email.support':       true,
  'email.rh':            true,
  'email.system':        true,
  'inapp.invoice':       true,
  'inapp.login':         true,
  'inapp.accountChange': true,
  'inapp.support':       true,
  'inapp.rh':            true,
  'inapp.system':        true,
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
    },
    inapp: {
      invoice:       bool('inapp.invoice'),
      login:         bool('inapp.login'),
      accountChange: bool('inapp.accountChange'),
      support:       bool('inapp.support'),
      rh:            bool('inapp.rh'),
      system:        bool('inapp.system'),
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
    const entries = Object.entries(dto).filter(([, v]) => v !== undefined) as [string, boolean][];
    for (const [field, val] of entries) {
      await this.redis.hset(key, field, val ? 'true' : 'false');
    }
    const hash = await this.redis.hgetall(key);
    return buildPrefsFromHash(hash);
  }
}
