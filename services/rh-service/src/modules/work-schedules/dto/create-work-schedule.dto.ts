import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body for `POST /work-schedule/:employeeId`.
 *
 * Each weekday field is the number of HOURS expected on that day.
 * `0` means day off (weekends typically, or a shortened week). The
 * service does NOT cap the total weekly hours at 40/44/etc — HR
 * knows their labor laws better than we do. We only enforce the
 * per-day physical cap of 24h.
 *
 * `effectiveFrom` is the first date this schedule applies. Creating
 * a new schedule with the same `effectiveFrom` as an existing one
 * for the same employee produces a 409 from the DB unique index.
 */
export class CreateWorkScheduleDto {
  @Type(() => Number)
  @IsInt({ message: 'monday must be an integer' })
  @Min(0, { message: 'monday must be >= 0' })
  @Max(24, { message: 'monday must be <= 24' })
  monday!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24)
  tuesday!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24)
  wednesday!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24)
  thursday!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24)
  friday!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24)
  saturday!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24)
  sunday!: number;

  @IsDateString({}, { message: 'effectiveFrom must be an ISO-8601 date (YYYY-MM-DD)' })
  effectiveFrom!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
