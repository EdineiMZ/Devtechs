import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class IssueKeyDto {
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsArray()
  @IsString({ each: true })
  modules!: string[];

  @IsInt()
  @Min(1)
  validityDays!: number;
}

export class RevokeKeyDto {
  @IsString()
  @IsNotEmpty()
  keyId!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
