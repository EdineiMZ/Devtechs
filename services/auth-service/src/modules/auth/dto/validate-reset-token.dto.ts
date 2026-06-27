import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class ValidateResetTokenDto {
  @ApiProperty({ description: 'Reset token from the email link.' })
  @IsString()
  token!: string;

  @ApiProperty({ description: 'Email address the reset was requested for.', format: 'email' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;
}
