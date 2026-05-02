import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';

import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { PermissionResolverService } from '../../common/permissions/permission-resolver.service';

import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/invoice.dto';

class InvoiceActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesService } from './invoices.service';

const INVOICE_PERMISSION = 'finance:invoices:issue';

/** Invoice CRUD — writes require `finance:invoices:issue`. Clients can read their own. */
@Controller('invoices')
@UseGuards(PermissionGuard)
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly pdf: InvoicePdfService,
    private readonly resolver: PermissionResolverService,
  ) {}

  /** Staff see all invoices; clients only see their own (clientId forced to self). */
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @Query('projectId') projectId?: string,
    @Query('clientId') clientId?: string,
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<unknown[]> {
    if (!user) throw new ForbiddenException('Authentication required');
    const perms = await this.resolver.getPermissions(user.id);
    if (!perms.has(INVOICE_PERMISSION)) {
      // Clients may only see their own invoices
      return this.invoices.list({ projectId, clientId: user.id });
    }
    return this.invoices.list({ projectId, clientId });
  }

  /** Staff see any invoice; clients only see invoices belonging to them. */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async get(
    @Param('id') id: string,
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<unknown> {
    if (!user) throw new ForbiddenException('Authentication required');
    const perms = await this.resolver.getPermissions(user.id);
    if (!perms.has(INVOICE_PERMISSION)) {
      return this.invoices.getForClient(id, user.id);
    }
    return this.invoices.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('finance:invoices:issue')
  create(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.invoices.create(dto, user.id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('finance:invoices:issue')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ): Promise<unknown> {
    return this.invoices.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('finance:invoices:issue')
  remove(@Param('id') id: string): Promise<{ message: string; id: string }> {
    return this.invoices.remove(id);
  }

  /** Cancel an invoice (not yet paid). Marks status CANCELLED, notifies client. */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('finance:invoices:issue')
  cancel(
    @Param('id') id: string,
    @Body() dto: InvoiceActionDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.invoices.cancel(id, dto.reason, user.id);
  }

  /** Refund a paid invoice. Marks status REFUNDED, notifies client. */
  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('finance:invoices:issue')
  refund(
    @Param('id') id: string,
    @Body() dto: InvoiceActionDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.invoices.refund(id, dto.reason, user.id);
  }

  /**
   * GET /invoices/:id/pdf — renders the invoice to a PDF via
   * Puppeteer and streams it back with
   * `Content-Disposition: attachment`. The browser downloads it
   * as `nota-fiscal-${number}.pdf`.
   */
  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  async downloadPdf(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<void> {
    if (!user) throw new ForbiddenException('Authentication required');
    const perms = await this.resolver.getPermissions(user.id);
    const invoice = perms.has(INVOICE_PERMISSION)
      ? await this.invoices.findWithItems(id)
      : await this.invoices.findWithItemsForClient(id, user.id);
    const buffer = await this.pdf.render({
      number: invoice.number,
      subtotal: Number(invoice.subtotal),
      tax: Number(invoice.tax),
      total: Number(invoice.total),
      status: invoice.status,
      issuedAt: invoice.issuedAt,
      dueDate: invoice.dueDate,
      notes: invoice.notes,
      client: { name: invoice.client.name, email: invoice.client.email },
      creator: invoice.creator
        ? { name: invoice.creator.name, email: invoice.creator.email }
        : null,
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
    });
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nota-fiscal-${invoice.number}.pdf"`,
    );
    res.end(buffer);
  }
}
