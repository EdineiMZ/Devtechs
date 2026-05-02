/** Product info returned on successful verification. */
export interface LicenseProductInfo {
  id: string;
  name: string;
  appId: string;
}

/** Result of a license verification call. */
export interface LicenseVerificationResult {
  /** Whether the license key is valid. */
  valid: boolean;
  /** Reason for rejection (only present when valid=false). */
  reason?: string;
  /** Client ID that owns this license (only present when valid=true). */
  clientId?: string;
  /** Product information (only present when valid=true). */
  product?: LicenseProductInfo;
  /** Expiration date ISO string, null if no expiration. */
  expiresAt?: string | null;
}

/** Options for the verify() method. */
export interface LicenseVerifyOptions {
  /** Hardware fingerprint for hardware-bound licenses. */
  hardwareId?: string;
  /** Application version string for audit logging. */
  appVersion?: string;
}
