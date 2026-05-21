export type VerificationStatus =
  | "checking"
  | "verified"
  | "grace"
  | "required"
  | "expired"
  | "error"

export interface VerificationStateSnapshot {
  status: VerificationStatus
  verifiedUserId: string | null
  verifiedDeviceId: string | null
  accessTokenExpiresAt: number | null
  lastVerifiedAt: number | null
  offlineGraceExpiresAt: number | null
  error: string | null
}

export interface VerificationSession {
  verifiedUserId: string
  verifiedDeviceId: string
  accessTokenExpiresAt: number
  lastVerifiedAt: number
  offlineGraceExpiresAt: number
}
