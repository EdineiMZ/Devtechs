import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { PrismaService } from '../../prisma/prisma.service';

class UpsertCompanySettingsDto {
  @IsString() @MaxLength(200) name!: string;

  @IsOptional() @IsString() @MaxLength(200) tradeName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{14}$/, { message: 'CNPJ must be 14 digits' })
  cnpj?: string;

  @IsOptional() @IsString() @MaxLength(30) stateRegistration?: string;
  @IsOptional() @IsString() @MaxLength(30) municipalRegistration?: string;
  @IsOptional() @IsString() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;

  @IsOptional() @IsString() @MaxLength(300) addressStreet?: string;
  @IsOptional() @IsString() @MaxLength(30) addressNumber?: string;
  @IsOptional() @IsString() @MaxLength(100) addressComplement?: string;
  @IsOptional() @IsString() @MaxLength(100) addressNeighborhood?: string;
  @IsOptional() @IsString() @MaxLength(100) addressCity?: string;
  @IsOptional() @IsString() @MaxLength(2) addressState?: string;
  @IsOptional() @IsString() @Matches(/^\d{8}$/, { message: 'CEP must be 8 digits' }) addressZip?: string;

  @IsOptional() @IsString() @MaxLength(300) paymentAddressStreet?: string;
  @IsOptional() @IsString() @MaxLength(30) paymentAddressNumber?: string;
  @IsOptional() @IsString() @MaxLength(100) paymentAddressComplement?: string;
  @IsOptional() @IsString() @MaxLength(100) paymentAddressNeighborhood?: string;
  @IsOptional() @IsString() @MaxLength(100) paymentAddressCity?: string;
  @IsOptional() @IsString() @MaxLength(2) paymentAddressState?: string;
  @IsOptional() @IsString() @Matches(/^\d{8}$/, { message: 'CEP must be 8 digits' }) paymentAddressZip?: string;

  @IsOptional() @IsString() logoKey?: string;
  @IsOptional() @IsString() @MaxLength(2000) invoiceFooter?: string;
}

@ApiTags('company')
@ApiBearerAuth('bearer')
@Controller('company')
@SkipThrottle()
export class CompanySettingsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public endpoint — the company name / logo are shown on public-facing
   * pages (client portal, invoice PDFs) without requiring auth.
   */
  @Get('settings')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get company settings (public)' })
  async getSettings() {
    const row = await this.prisma.companySettings.findFirst();
    if (!row) return null;
    return this.toResponse(row);
  }

  @Put('settings')
  @UseGuards(PermissionGuard)
  @RequirePermission('dev:config:edit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upsert company settings (admin only)' })
  async upsertSettings(@Body() dto: UpsertCompanySettingsDto) {
    const existing = await this.prisma.companySettings.findFirst({ select: { id: true } });

    const data = {
      name: dto.name,
      tradeName: dto.tradeName ?? null,
      cnpj: dto.cnpj ?? null,
      stateRegistration: dto.stateRegistration ?? null,
      municipalRegistration: dto.municipalRegistration ?? null,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      website: dto.website ?? null,
      addressStreet: dto.addressStreet ?? null,
      addressNumber: dto.addressNumber ?? null,
      addressComplement: dto.addressComplement ?? null,
      addressNeighborhood: dto.addressNeighborhood ?? null,
      addressCity: dto.addressCity ?? null,
      addressState: dto.addressState ?? null,
      addressZip: dto.addressZip ?? null,
      paymentAddressStreet: dto.paymentAddressStreet ?? null,
      paymentAddressNumber: dto.paymentAddressNumber ?? null,
      paymentAddressComplement: dto.paymentAddressComplement ?? null,
      paymentAddressNeighborhood: dto.paymentAddressNeighborhood ?? null,
      paymentAddressCity: dto.paymentAddressCity ?? null,
      paymentAddressState: dto.paymentAddressState ?? null,
      paymentAddressZip: dto.paymentAddressZip ?? null,
      logoKey: dto.logoKey ?? null,
      invoiceFooter: dto.invoiceFooter ?? null,
    };

    let row;
    if (existing) {
      row = await this.prisma.companySettings.update({
        where: { id: existing.id },
        data,
      });
    } else {
      row = await this.prisma.companySettings.create({ data });
    }

    return this.toResponse(row);
  }

  private toResponse(row: any) {
    return {
      id: row.id,
      name: row.name,
      tradeName: row.tradeName,
      cnpj: row.cnpj,
      cnpjFormatted: row.cnpj
        ? row.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
        : null,
      stateRegistration: row.stateRegistration,
      municipalRegistration: row.municipalRegistration,
      email: row.email,
      phone: row.phone,
      website: row.website,
      address: {
        street: row.addressStreet,
        number: row.addressNumber,
        complement: row.addressComplement,
        neighborhood: row.addressNeighborhood,
        city: row.addressCity,
        state: row.addressState,
        zip: row.addressZip,
        zipFormatted: row.addressZip
          ? row.addressZip.replace(/^(\d{5})(\d{3})$/, '$1-$2')
          : null,
      },
      paymentAddress: {
        street: row.paymentAddressStreet,
        number: row.paymentAddressNumber,
        complement: row.paymentAddressComplement,
        neighborhood: row.paymentAddressNeighborhood,
        city: row.paymentAddressCity,
        state: row.paymentAddressState,
        zip: row.paymentAddressZip,
        zipFormatted: row.paymentAddressZip
          ? row.paymentAddressZip.replace(/^(\d{5})(\d{3})$/, '$1-$2')
          : null,
      },
      logoKey: row.logoKey,
      invoiceFooter: row.invoiceFooter,
      updatedAt: row.updatedAt,
    };
  }
}
