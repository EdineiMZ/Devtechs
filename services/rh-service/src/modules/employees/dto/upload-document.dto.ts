import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Document types, mirroring the `EmployeeDocumentType` enum in
 * schema.prisma. String tuple so the DTO file stays Prisma-free.
 */
export const EMPLOYEE_DOCUMENT_TYPES = [
  'CONTRACT',
  'ID',
  'CERTIFICATE',
  'OTHER',
] as const;
export type EmployeeDocumentTypeLiteral = (typeof EMPLOYEE_DOCUMENT_TYPES)[number];

/**
 * Body for `POST /employees/:id/documents`.
 *
 * Consumed as multipart/form-data: the file itself comes in through
 * `FileInterceptor('file')` and this DTO validates the text fields.
 * NestJS's ValidationPipe + class-validator handles form-data the
 * same way it handles JSON — the field types just have to be
 * strings, so `type` is a string enum and callers send the literal
 * value.
 */
export class UploadEmployeeDocumentDto {
  @IsString({ message: 'name must be a string' })
  @MinLength(1, { message: 'name is required' })
  @MaxLength(200, { message: 'name must be at most 200 characters long' })
  name!: string;

  @IsEnum(EMPLOYEE_DOCUMENT_TYPES, {
    message: `type must be one of: ${EMPLOYEE_DOCUMENT_TYPES.join(', ')}`,
  })
  type!: EmployeeDocumentTypeLiteral;

  /** Optional description, stored alongside the blob for display. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
