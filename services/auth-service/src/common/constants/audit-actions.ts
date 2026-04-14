/**
 * Canonical list of audit actions emitted by the auth-service.
 *
 * Kept as a `const` object (instead of a TypeScript enum) so it can be
 * consumed from JavaScript consumers, serialized directly, and still
 * provide a type via `typeof`. Use `AuditAction.LOGIN_SUCCESS` from
 * TypeScript code instead of bare strings so typos become compile
 * errors.
 */
export const AuditAction = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGIN_BLOCKED: 'LOGIN_BLOCKED',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
  TWO_FA_ENABLED: '2FA_ENABLED',
  TWO_FA_DISABLED: '2FA_DISABLED',
  TWO_FA_FAILED: '2FA_FAILED',
  SESSION_REVOKED: 'SESSION_REVOKED',
  SESSION_REVOKED_ALL: 'SESSION_REVOKED_ALL',
  ROLE_ASSIGNED: 'ROLE_ASSIGNED',
  ROLE_REMOVED: 'ROLE_REMOVED',
  PERMISSION_GRANTED: 'PERMISSION_GRANTED',
  PERMISSION_REVOKED: 'PERMISSION_REVOKED',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];
