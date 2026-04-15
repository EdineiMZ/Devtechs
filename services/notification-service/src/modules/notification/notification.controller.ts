import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
} from '@nestjs/common';

import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';

import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { NotificationService } from './notification.service';

/**
 * REST endpoints for the authenticated user's own notifications.
 *
 * Every route is scoped to `CurrentUser.id` — the service enforces
 * ownership on reads AND writes so a token holder can never touch
 * someone else's inbox.
 */
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

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
}
