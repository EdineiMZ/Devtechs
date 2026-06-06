import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export const CHECKOUT_METHODS = ['pix', 'card'] as const;
export type CheckoutMethod = (typeof CHECKOUT_METHODS)[number];

export class CardDetailsDto {
  @IsString()
  token!: string;

  @IsString()
  installments!: string;

  @IsOptional()
  @IsString()
  issuerId?: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}

export class CheckoutInvoiceDto {
  @IsEnum(CHECKOUT_METHODS)
  method!: CheckoutMethod;

  @IsOptional()
  @IsEmail()
  payerEmail?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CardDetailsDto)
  card?: CardDetailsDto;
}
