import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';

import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/invoice.dto';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesService } from './invoices.service';

/** Invoice CRUD — every write requires `finance:invoices:issue`. */
@Controller('invoices')
@UseGuards(PermissionGuard)
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly pdf: InvoicePdfService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('finance:invoices:issue')
  list(): Promise<unknown[]> {
    return this.invoices.list();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('finance:invoices:issue')
  get(@Param('id') id: string): Promise<unknown> {
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

  /**
   * GET /invoices/:id/pdf — renders the invoice to a PDF via
   * Puppeteer and streams it back with
   * `Content-Disposition: attachment`. The browser downloads it
   * as `nota-fiscal-${number}.pdf`.
   */
  @Get(':id/pdf')
  @RequirePermission('finance:invoices:issue')
  @Header('Content-Type', 'application/pdf')
  async downloadPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const invoice = await this.invoices.findWithItems(id);
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
