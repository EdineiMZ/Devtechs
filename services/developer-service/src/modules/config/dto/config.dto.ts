import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateStorageDto {
  @IsString()
  @IsIn(['r2', 'local'])
  provider!: 'r2' | 'local';
}

export class UpdateFeatureFlagDto {
  @IsBoolean()
  enabled!: boolean;
}

export class UpdateEmailProviderDto {
  @IsString()
  @IsIn(['resend', 'gmail', 'smtp'])
  provider!: 'resend' | 'gmail' | 'smtp';
}

export class SaveSmtpCredentialsDto {
  @IsString()
  host!: string;

  @IsString()
  port!: string;

  @IsString()
  user!: string;

  @IsString()
  pass!: string;

  @IsString()
  from!: string;
}

export class SaveGmailCredentialsDto {
  @IsString()
  user!: string;

  @IsString()
  clientId!: string;

  @IsString()
  clientSecret!: string;

  @IsString()
  refreshToken!: string;
}

export class GmailAuthCallbackDto {
  @IsString()
  code!: string;

  @IsString()
  @IsOptional()
  redirectUri?: string;
}

export class UpdateApiKeyDto {
  @IsString()
  value!: string;
}

export class UpdatePaymentProviderDto {
  @IsString()
  @IsIn(['mercadopago', 'stripe'])
  provider!: 'mercadopago' | 'stripe';
}
