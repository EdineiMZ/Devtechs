import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const PIPELINE_STATUSES = [
  'QUEUED',
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'CANCELLED',
] as const;
export type PipelineStatusLiteral = (typeof PIPELINE_STATUSES)[number];

export class QueryPipelinesDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsEnum(PIPELINE_STATUSES)
  status?: PipelineStatusLiteral;

  @IsOptional()
  @IsString()
  branch?: string;

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

export class TriggerPipelineDto {
  @IsString()
  projectId!: string;

  @IsString()
  owner!: string;

  @IsString()
  repo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  workflowId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  ref!: string;

  @IsOptional()
  @IsObject()
  inputs?: Record<string, string>;
}
