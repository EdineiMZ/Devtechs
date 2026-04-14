import { IsEnum, IsOptional } from 'class-validator';

import { AUDIT_MODULE_VALUES } from '../../audit/dto/query-audit.dto';

export class QueryRolesDto {
  /**
   * Filter roles down to those holding at least one permission in the
   * given module. Re-uses the `PermissionModule` enum values defined
   * for audit log filtering.
   */
  @IsOptional()
  @IsEnum(AUDIT_MODULE_VALUES, {
    message: `module must be one of: ${AUDIT_MODULE_VALUES.join(', ')}`,
  })
  module?: (typeof AUDIT_MODULE_VALUES)[number];
}
