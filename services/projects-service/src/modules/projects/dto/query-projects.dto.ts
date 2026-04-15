import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import {
  PROJECT_STATUSES,
  type ProjectStatusLiteral,
} from './create-project.dto';

export class QueryProjectsDto {
  @IsOptional()
  @IsEnum(PROJECT_STATUSES)
  status?: ProjectStatusLiteral;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  /** Substring match against name + description. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
