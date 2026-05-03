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
  // ── Authentication ──────────────────────────────────────────────────
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  /** IP or account blocked by the rate-limiter or brute-force guard. */
  LOGIN_BLOCKED: 'LOGIN_BLOCKED',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',

  // ── OAuth ───────────────────────────────────────────────────────────
  /** Social login (Google, GitHub, etc.) completed successfully. */
  OAUTH_LOGIN_SUCCESS: 'OAUTH_LOGIN_SUCCESS',
  /** OAuth callback failed — provider error, state mismatch, or revoked token. */
  OAUTH_LOGIN_FAILED: 'OAUTH_LOGIN_FAILED',

  // ── Password ────────────────────────────────────────────────────────
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  /** Attempt to use an expired or already-used reset token. */
  PASSWORD_RESET_INVALID_TOKEN: 'PASSWORD_RESET_INVALID_TOKEN',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PASSWORD_CHANGE_FAILED: 'PASSWORD_CHANGE_FAILED',

  // ── Profile ─────────────────────────────────────────────────────────
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  /**
   * E-mail address successfully changed. Logged separately from
   * PROFILE_UPDATED because changing the email alters the login
   * credential — critical for post-incident investigation.
   * meta: { oldEmail, newEmail }
   */
  EMAIL_CHANGED: 'EMAIL_CHANGED',

  // ── Account status ──────────────────────────────────────────────────
  /** Account temporarily locked after repeated failed login attempts. */
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  /** Account manually or automatically unlocked. */
  ACCOUNT_UNLOCKED: 'ACCOUNT_UNLOCKED',

  // ── 2FA ─────────────────────────────────────────────────────────────
  TWO_FA_ENABLED: '2FA_ENABLED',
  TWO_FA_DISABLED: '2FA_DISABLED',
  TWO_FA_FAILED: '2FA_FAILED',
  TWO_FA_RECOVERY_GENERATED: '2FA_RECOVERY_GENERATED',
  TWO_FA_RECOVERY_USED: '2FA_RECOVERY_USED',
  TWO_FA_SESSION_VERIFIED: '2FA_SESSION_VERIFIED',

  // ── Sessions ────────────────────────────────────────────────────────
  SESSION_REVOKED: 'SESSION_REVOKED',
  SESSION_REVOKED_ALL: 'SESSION_REVOKED_ALL',

  // ── Roles & permissions ─────────────────────────────────────────────
  ROLE_ASSIGNED: 'ROLE_ASSIGNED',
  ROLE_REMOVED: 'ROLE_REMOVED',
  PERMISSION_GRANTED: 'PERMISSION_GRANTED',
  PERMISSION_REVOKED: 'PERMISSION_REVOKED',

  // ── LGPD art. 18 — direitos do titular ─────────────────────────────
  DATA_EXPORT_REQUESTED: 'DATA_EXPORT_REQUESTED',
  ACCOUNT_DELETION_REQUESTED: 'ACCOUNT_DELETION_REQUESTED',
  ACCOUNT_DELETED: 'ACCOUNT_DELETED',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];
