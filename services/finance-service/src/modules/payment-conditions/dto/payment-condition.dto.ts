import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreatePaymentConditionDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @Min(1)
  @Max(48)
  installments!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  interestRate!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdatePaymentConditionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(48)
  installments?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  interestRate?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
