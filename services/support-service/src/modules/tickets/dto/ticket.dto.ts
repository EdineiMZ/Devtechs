import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const TICKET_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CLIENT',
  'RESOLVED',
  'CLOSED',
] as const;
export type TicketStatusLiteral = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type TicketPriorityLiteral = (typeof TICKET_PRIORITIES)[number];

export const TICKET_CATEGORIES = [
  'BUG',
  'FEATURE',
  'QUESTION',
  'BILLING',
  'OTHER',
] as const;
export type TicketCategoryLiteral = (typeof TICKET_CATEGORIES)[number];

/** Body for `POST /tickets`. `clientId` is never read from the
 *  body — the service sets it from the JWT subject so a client
 *  can't impersonate another client. */
export class CreateTicketDto {
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @IsOptional()
  @IsEnum(TICKET_PRIORITIES)
  priority?: TicketPriorityLiteral;

  @IsOptional()
  @IsEnum(TICKET_CATEGORIES)
  category?: TicketCategoryLiteral;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];
}

/** Body for `PUT /tickets/:id/assign`. */
export class AssignTicketDto {
  @IsString()
  assigneeId!: string;
}

/** Body for `PUT /tickets/:id/status`. */
export class UpdateStatusDto {
  @IsEnum(TICKET_STATUSES)
  status!: TicketStatusLiteral;
}

/** Body for `POST /tickets/:id/messages`. Internal notes are only
 *  persisted when the author holds `support:tickets:close`. */
export class CreateMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  body!: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1)
  isInternal?: boolean;
}

/** Body for `POST /tickets/:id/rating`. */
export class RateTicketDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  ratingComment?: string;
}

/** Query string for `GET /tickets`. */
export class QueryTicketsDto {
  @IsOptional()
  @IsEnum(TICKET_STATUSES)
  status?: TicketStatusLiteral;

  @IsOptional()
  @IsEnum(TICKET_PRIORITIES)
  priority?: TicketPriorityLiteral;

  @IsOptional()
  @IsEnum(TICKET_CATEGORIES)
  category?: TicketCategoryLiteral;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

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
