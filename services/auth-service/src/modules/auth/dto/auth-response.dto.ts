/**
 * DTOs describing the JSON contracts returned by the auth controller.
 * These are not validated (they are output-only), but we keep them as
 * classes/interfaces so the service and controller share the same shapes.
 */

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  /** All roles assigned to the user (canonical `Role.name` values). */
  roles: string[];
  /**
   * The user's primary role — the first element of `roles` by convention.
   * Controllers should use this when they only want one role to display.
   */
  primaryRole: string | null;
  /** Whether the user has verified their email. The frontend bounces
   *  to /verificar-email when false so it needs to be in the payload. */
  emailVerified: boolean;
  /** All permission keys granted to the user via roles + direct grants.
   *  Frontend middleware uses this for per-route authorization checks. */
  permissions: string[];
}

/**
 * Happy-path login response: full session tokens plus user info.
 * `requires2FA` is the discriminator so clients can do
 * `if (res.requires2FA) { ... } else { ... }`.
 */
export interface LoginSuccessResponse {
  requires2FA: false;
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

/**
 * Intermediate response returned when the user has 2FA enabled.
 * The client must follow up with POST /auth/2fa/verify carrying
 * the `tempToken` and the 6-digit TOTP code from the authenticator.
 */
export interface TwoFactorRequiredResponse {
  requires2FA: true;
  tempToken: string;
  /** ISO timestamp at which the temp token stops being valid (now + 5 min). */
  tempTokenExpiresAt: string;
}

/** Union of both login outcomes. */
export type LoginResponse = LoginSuccessResponse | TwoFactorRequiredResponse;

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResponse {
  message: string;
  userId: string;
}

export interface LogoutResponse {
  message: string;
}

export interface SendVerificationResponse {
  message: string;
  /** ISO timestamp at which the generated token stops being valid. */
  expiresAt: string;
}

export interface VerifyEmailResponse {
  message: string;
  userId: string;
  verifiedAt: string;
}

// ---------------------------------------------------------------------------
// 2FA
// ---------------------------------------------------------------------------

export interface Setup2FAResponse {
  /** Data URL (`data:image/png;base64,...`) ready to render in an <img>. */
  qrCode: string;
  /** Base32 secret the user can type in manually if they can't scan the QR. */
  manualKey: string;
  /** Raw otpauth URL if the client prefers to render its own QR. */
  otpauthUrl: string;
}

export interface Enable2FAResponse {
  message: string;
  enabledAt: string;
}

export interface Disable2FAResponse {
  message: string;
  disabledAt: string;
}
