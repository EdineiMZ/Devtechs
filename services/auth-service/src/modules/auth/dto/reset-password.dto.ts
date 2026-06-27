import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
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

  @ApiProperty({ description: 'New password.', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8, { message: 'newPassword must be at least 8 characters long' })
  @MaxLength(128, { message: 'newPassword must be at most 128 characters long' })
  newPassword!: string;
}
