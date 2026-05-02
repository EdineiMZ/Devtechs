import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

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
  hardwareId?: string;
}

export class VerifyTokenDto {
  @IsString()
  key!: string;

  @IsOptional()
  @IsString()
  hardwareId?: string;

  @IsString()
  appId!: string;
}

export class RevokeTokenDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
