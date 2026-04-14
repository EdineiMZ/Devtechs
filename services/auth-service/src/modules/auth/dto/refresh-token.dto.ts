import { IsJWT, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString({ message: 'refreshToken must be a string' })
  @IsJWT({ message: 'refreshToken must be a valid JWT' })
  refreshToken!: string;
}
