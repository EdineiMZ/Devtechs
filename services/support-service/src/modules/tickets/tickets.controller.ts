import * as path from 'node:path';
import * as fs from 'node:fs';

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { fromBuffer } from 'file-type';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Response } from 'express';

import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';

import {
  AssignTicketDto,
  CreateMessageDto,
  CreateTicketDto,
  QueryTicketsDto,
  RateTicketDto,
  UpdateStatusDto,
} from './dto/ticket.dto';
import { TicketsService } from './tickets.service';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
]);

/**
 * Ticket REST endpoints. Permissions per spec:
 *
 *   - GET /tickets, GET /tickets/:id  → support:tickets:view
 *   - POST /tickets                    → any authenticated user
 *   - PUT /tickets/:id/assign          → support:tickets:close
 *   - PUT /tickets/:id/status          → support:tickets:close
 *   - POST /tickets/:id/messages       → any authenticated user
 *   - PUT /tickets/:id/close           → support:tickets:close
 *   - POST /tickets/:id/rating         → any authenticated user
 *   - GET /tickets/sla-breach          → support:sla:manage
 */
@Controller('tickets')
@UseGuards(PermissionGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  // -------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------

  /**
   * Any authenticated user can list tickets.
   * The service layer enforces ownership: non-agents only see their
   * own tickets (clientId = requesterId). Agents holding
   * `support:tickets:view` see every ticket and can filter freely.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  list(
    @Query() query: QueryTicketsDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.tickets.list(query, user.id);
  }

  @Get('sla-breach')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('support:sla:manage')
  slaBreach(): Promise<unknown[]> {
    return this.tickets.listSlaBreach();
  }

  /**
   * Any authenticated user can fetch a ticket.
   * The service throws 403 if the caller is not the ticket owner
   * and does not hold the agent permission.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  get(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.tickets.get(id, user.id);
  }

  // -------------------------------------------------------------------
  // Public contact-form endpoint (service-to-service, no JWT)
  // -------------------------------------------------------------------

  /**
   * Creates a ticket from the public contact form at /contato.
   * The caller must supply the AUTH_INTERNAL_SECRET in the
   * `x-internal-secret` header — no JWT is required or accepted.
   * The resulting ticket has no clientId; guest contact details are
   * stored in guestName / guestEmail / guestPhone.
   */
  @Public()
  @Post('public')
  @HttpCode(HttpStatus.CREATED)
  createPublic(
    @Headers('x-internal-secret') secret: string | undefined,
    @Body() body: {
      name: string;
      email: string;
      phone?: string;
      subject: string;
      message: string;
    },
  ): Promise<unknown> {
    const expected = process.env.AUTH_INTERNAL_SECRET;
    if (!expected || !secret || secret !== expected) {
      throw new UnauthorizedException('Invalid or missing internal secret');
    }
    return this.tickets.createPublic(body);
  }

  // -------------------------------------------------------------------
  // Writes — any authenticated user
  // -------------------------------------------------------------------

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateTicketDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.tickets.create(dto, user.id);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  addMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.tickets.addMessage(id, dto, user.id);
  }

  @Post(':id/rating')
  @HttpCode(HttpStatus.OK)
  rate(
    @Param('id') id: string,
    @Body() dto: RateTicketDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.tickets.rate(id, dto, user.id);
  }

  // -------------------------------------------------------------------
  // Writes — support staff
  // -------------------------------------------------------------------

  @Put(':id/assign')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('support:tickets:close')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.tickets.assign(id, dto, user.id);
  }

  @Put(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('support:tickets:close')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.tickets.updateStatus(id, dto, user.id);
  }

  @Put(':id/close')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('support:tickets:close')
  close(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.tickets.close(id, user.id);
  }

  // -------------------------------------------------------------------
  // Attachments
  // -------------------------------------------------------------------

  @Post(':id/attachments')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const tmpDir = path.join(process.cwd(), 'uploads', 'tmp');
          fs.mkdirSync(tmpDir, { recursive: true });
          cb(null, tmpDir);
        },
        filename: (_req, _file, cb) => {
          cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
          return cb(new BadRequestException(`File type "${file.mimetype}" is not allowed`), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadAttachment(
    @Param('id') ticketId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('messageId') messageId: string | undefined,
    @Query('isPrivate') isPrivateParam: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    if (!file) {
      throw new BadRequestException('No file provided or file type rejected');
    }

    // Magic bytes verification — rejects files with spoofed Content-Type
    const fileBuffer = fs.readFileSync(file.path);
    const detected = await fromBuffer(fileBuffer);
    if (detected && !ALLOWED_MIME_TYPES.has(detected.mime)) {
      fs.unlinkSync(file.path);
      throw new BadRequestException(
        `File content type "${detected.mime}" does not match allowed types`,
      );
    }

    const isPrivate = isPrivateParam === 'true' || isPrivateParam === '1';
    return this.tickets.uploadAttachment(ticketId, user.id, file, messageId, isPrivate);
  }

  @Get(':id/attachments/:attachmentId')
  async downloadAttachment(
    @Param('id') ticketId: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ): Promise<void> {
    const { attachment, filePath } = await this.tickets.getAttachment(
      ticketId,
      attachmentId,
      user.id,
    );
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(attachment.filename)}"`,
    );
    res.sendFile(path.resolve(filePath));
  }
}
