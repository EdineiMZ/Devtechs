import { IsString } from 'class-validator';

export class BindClientDto {
  @IsString()
  productId!: string;
}
