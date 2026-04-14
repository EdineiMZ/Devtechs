import { IsNumberString, IsString, Length } from 'class-validator';

export class Enable2FADto {
  /** Six-digit TOTP code shown by the authenticator app. */
  @IsString({ message: 'code must be a string' })
  @Length(6, 6, { message: 'code must be exactly 6 digits' })
  @IsNumberString({ no_symbols: true }, { message: 'code must contain only digits' })
  code!: string;
}
