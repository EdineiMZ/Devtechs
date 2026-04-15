import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body for `POST /tasks/:id/time-entries`.
 *
 * `userId` is required because the API is service-to-service
 * (admins logging time on behalf of others) — the controller does
 * NOT default to the authenticated user, so callers always pass
 * it explicitly. Date is the day the work was done, not the day
 * it was logged.
 */
export class CreateTimeEntryDto {
  @IsString()
  userId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'hours must be > 0' })
  @Max(24, { message: 'hours must be <= 24 (use multiple entries for multi-day work)' })
  hours!: number;

  @IsDateString({}, { message: 'date must be an ISO-8601 date (YYYY-MM-DD)' })
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
