import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

export interface AuditMetadata {
  /** Action name — use `AuditAction.*` for type safety. */
  action: string;
  /** PermissionModule enum value. Defaults to 'AUTH' at log time. */
  module?: string;
  /**
   * When true, the interceptor also emits an audit record on error
   * (with action suffixed `_FAILED`). Off by default — most failure
   * paths are better logged from inside the service so they can
   * include the specific reason.
   */
  auditOnError?: boolean;
}

/**
 * Mark a route handler for automatic auditing.
 *
 * The paired `AuditInterceptor` reads this metadata, captures the
 * authenticated user + IP + timestamp from the request, and writes an
 * audit record on success. If `auditOnError` is set, it also records
 * failures with `${action}_FAILED`.
 *
 *   @Audit(AuditAction.LOGOUT)
 *   @Post('logout')
 *   logout() { ... }
 */
export const Audit = (
  action: string,
  module: string = 'AUTH',
  auditOnError = false,
): MethodDecorator & ClassDecorator =>
  SetMetadata(AUDIT_KEY, { action, module, auditOnError });
