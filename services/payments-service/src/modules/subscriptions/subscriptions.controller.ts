import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { CreateSubscriptionDto } from './dto/subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateSubscriptionDto,
  ): Promise<unknown> {
    return this.subscriptions.create(user.id, dto, user.email);
  }

  @Get('me')
  getMySubscription(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.subscriptions.getMySubscription(user.id);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  cancelMine(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.subscriptions.cancelMine(user.id);
  }
}
