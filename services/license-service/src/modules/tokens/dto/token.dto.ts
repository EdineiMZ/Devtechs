import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateTokenDto {
  @IsString()
  clientId!: string;

  @IsString()
  productId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  hardwareId?: string;
}

export class VerifyTokenDto {
  @IsString()
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  hardwareId?: string;

  @IsString()
  appId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  appVersion?: string;
}

export class RevokeTokenDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
