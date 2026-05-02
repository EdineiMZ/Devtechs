import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

const PAYMENT_METHODS = ['PIX', 'BOLETO', 'CREDIT_CARD', 'DEBIT_CARD'] as const;

export class CreateSubscriptionDto {
  @IsString()
  planId!: string;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsEnum(PAYMENT_METHODS)
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  method?: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD';
}
