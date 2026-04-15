import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { GithubService } from '../github/github.service';

import { QueryPipelinesDto, TriggerPipelineDto } from './dto/pipeline.dto';
import { PipelinesGateway } from './pipelines.gateway';
import { PipelinesService } from './pipelines.service';

/**
 * Pipelines REST + webhook ingress.
 *
 * NOTE ON THE WEBHOOK ROUTE: it's `@Public()` because GitHub
 * doesn't send a JWT — we verify authenticity via the HMAC
 * signature instead (GithubService.requireVerifiedSignature).
 * The raw body is read from `req.rawBody` which main.ts wires
 * up with a body-parser raw verify hook.
 */
@Controller()
@UseGuards(PermissionGuard)
export class PipelinesController {
  constructor(
    private readonly pipelines: PipelinesService,
    private readonly github: GithubService,
    private readonly gateway: PipelinesGateway,
  ) {}

  // -------------------------------------------------------------------
  // Authenticated REST
  // -------------------------------------------------------------------

  @Get('pipelines')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('devops:pipelines:view')
  list(@Query() query: QueryPipelinesDto): Promise<unknown> {
    return this.pipelines.list(query);
  }

  @Get('pipelines/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('devops:pipelines:view')
  get(@Param('id') id: string): Promise<unknown> {
    return this.pipelines.get(id);
  }

  @Get('pipelines/:id/logs')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('devops:logs:view')
  logs(@Param('id') id: string): Promise<unknown> {
    return this.pipelines.getLogs(id);
  }

  @Post('pipelines/trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('devops:deploys:trigger')
  trigger(
    @Body() dto: TriggerPipelineDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.pipelines.trigger(dto, user.id);
  }

  @Get('github/repos')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('devops:pipelines:view')
  listRepos(): Promise<unknown> {
    return this.github.listRepos();
  }

  // -------------------------------------------------------------------
  // GitHub webhook (public — HMAC-signed instead of JWT)
  // -------------------------------------------------------------------

  @Post('devops/github/webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-github-event') event: string | undefined,
  ): Promise<{ ok: boolean; event?: string }> {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    this.github.requireVerifiedSignature(rawBody, signature);

    // We only care about `workflow_run` and `push` today. Other
    // events are acknowledged with a 200 so GitHub doesn't retry.
    if (event === 'workflow_run') {
      const updated = await this.pipelines.upsertFromWebhook(
        req.body as Parameters<typeof this.pipelines.upsertFromWebhook>[0],
      );
      if (updated) {
        this.gateway.emitPipelineUpdate(updated.id, updated.status);
      }
    }
    return { ok: true, event };
  }
}
