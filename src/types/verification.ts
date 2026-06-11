export type VerificationStatus =
  | "checking"
  | "verified"
  /** Legacy stored-metadata value only — offline grace now surfaces as "verified". */
  | "grace"
  | "required"
  | "expired"
  | "error"

export type VerificationErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "device_limit_reached"
  | "suspended"
  | "network"
  | "unknown"

export interface VerificationStateSnapshot {
  status: VerificationStatus
  verifiedUserId: string | null
  verifiedDeviceId: string | null
  accessTokenExpiresAt: number | null
  lastVerifiedAt: number | null
  /** When offline access expires if the network is unreachable (0 in legacy metadata). */
  offlineGraceExpiresAt: number | null
  error: string | null
  errorCode: VerificationErrorCode | null
  /** Signed-in account email for display; absent in legacy stored metadata. */
  verifiedEmail?: string | null
}

export interface VerificationSession {
  verifiedUserId: string
  verifiedDeviceId: string
  accessTokenExpiresAt: number
  lastVerifiedAt: number
  /** When offline access expires if the network is unreachable (0 in legacy metadata). */
  offlineGraceExpiresAt: number
  /** Signed-in account email for display; absent in legacy stored metadata. */
  verifiedEmail?: string | null
}
