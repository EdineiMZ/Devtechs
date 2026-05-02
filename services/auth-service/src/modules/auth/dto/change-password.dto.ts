import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Body for `POST /auth/me/password`. Same strength rules as
 * `RegisterDto.password` so the user can't downgrade to a weaker
 * password.
 */
export class ChangePasswordDto {
  @IsString({ message: 'currentPassword deve ser uma string' })
  @MinLength(8, { message: 'currentPassword deve ter ao menos 8 caracteres' })
  @MaxLength(128, { message: 'currentPassword deve ter no máximo 128 caracteres' })
  currentPassword!: string;

  @IsString({ message: 'newPassword deve ser uma string' })
  @MinLength(8, { message: 'newPassword deve ter ao menos 8 caracteres' })
  @MaxLength(128, { message: 'newPassword deve ter no máximo 128 caracteres' })
  @Matches(/(?=.*[a-z])/, {
    message: 'newPassword deve conter ao menos uma letra minúscula',
  })
  @Matches(/(?=.*[A-Z])/, {
    message: 'newPassword deve conter ao menos uma letra maiúscula',
  })
  @Matches(/(?=.*\d)/, {
    message: 'newPassword deve conter ao menos um dígito',
  })
  newPassword!: string;
}
