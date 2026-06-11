import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class MpWebhookDto {
  @IsString()
  @IsNotEmpty()
  action!: string;

  @IsObject()
  data!: { id: string | number };

  @IsString()
  @IsOptional()
  type?: string;
}
