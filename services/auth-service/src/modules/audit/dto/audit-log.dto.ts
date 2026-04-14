/**
 * Input shape accepted by `AuditService.log()`.
 *
 * All fields except `action` are optional: the audit record is a
 * best-effort trail, and callers often have only partial context
 * (e.g. `LOGIN_FAILED` has an email but no userId).
 */
export interface AuditLogInput {
  /** Authenticated user id, if any. Null for anonymous events. */
  userId?: string | null;

  /** Canonical action name; use `AuditAction.*` constants. */
  action: string;

  /**
   * Which functional module the event belongs to. Must be a value of
   * the `PermissionModule` Prisma enum. Defaults to `AUTH` when the
   * audit originates from the auth-service.
   */
  module?: string;

  /** Optional id of the resource the action targeted. */
  resourceId?: string | null;

  /** Arbitrary JSON metadata (reason, email, old/new values, etc.). */
  meta?: Record<string, unknown>;

  /** IPv4/IPv6 address of the caller. */
  ipAddress?: string | null;
}
