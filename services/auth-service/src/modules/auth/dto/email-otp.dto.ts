import { IsEmail, IsString, Length } from 'class-validator';

export class RequestEmailOtpDto {
  @IsEmail()
  email!: string;
}

export class VerifyEmailOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
