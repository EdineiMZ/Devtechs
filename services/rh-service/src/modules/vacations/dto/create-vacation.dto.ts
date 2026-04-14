import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * VacationRequestType string tuple — duplicated from Prisma so the
 * HTTP layer doesn't pull the generated client through. Keep in sync
 * with `VacationRequestType` in schema.prisma.
 */
export const VACATION_TYPES = [
  'VACATION',
  'SICK_LEAVE',
  'PERSONAL',
  'MATERNITY',
  'PATERNITY',
  'OTHER',
] as const;
export type VacationTypeLiteral = (typeof VACATION_TYPES)[number];

/**
 * Body for `POST /vacations`.
 *
 * The service layer computes `daysCount` automatically (excluding
 * weekends) so callers don't have to do it themselves. If the
 * requester's own userId maps to the `employeeId` they're allowed
 * to submit; otherwise `rh:vacations:approve` is required to submit
 * on behalf of another employee.
 */
export class CreateVacationDto {
  /** Target employee. Must match the requester's own employee id
   *  unless the caller also holds `rh:vacations:approve`. */
  @IsString({ message: 'employeeId is required' })
  employeeId!: string;

  @IsEnum(VACATION_TYPES, {
    message: `type must be one of: ${VACATION_TYPES.join(', ')}`,
  })
  type!: VacationTypeLiteral;

  @IsDateString({}, { message: 'startDate must be an ISO-8601 date (YYYY-MM-DD)' })
  startDate!: string;

  @IsDateString({}, { message: 'endDate must be an ISO-8601 date (YYYY-MM-DD)' })
  endDate!: string;

  /**
   * Free-text context the requester provides ("family trip", "medical
   * appointment", etc.). Surfaced in the approval UI and in the
   * approved/rejected email payload.
   */
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'notes must be at most 1000 characters' })
  notes?: string;
}
