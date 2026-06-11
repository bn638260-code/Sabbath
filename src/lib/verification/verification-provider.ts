import packageJson from "../../../package.json"
import {
  restoreSession,
  signInWithEmail,
  signOut as supabaseSignOut,
  signUpWithEmail,
} from "@/lib/supabase/auth"
import { registerDevice } from "@/lib/supabase/devices"
import { getOrCreateDeviceId } from "@/lib/verification/device-id"
import {
  clearSessionMetadata,
  getRefreshToken,
  getSessionMetadata,
  setSessionMetadata,
} from "@/lib/verification/session-storage"
import { isTauriRuntime } from "@/lib/tauri-runtime"
import type {
  VerificationErrorCode,
  VerificationSession,
  VerificationStateSnapshot,
} from "@/types/verification"

const APP_VERSION = packageJson.version

/** How long a previously verified session may keep working without connectivity. */
export const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000

function now(): number {
  return Date.now()
}

function getRuntimeOs(): string {
  if (typeof navigator === "undefined") return "unknown"
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes("win")) return "windows"
  if (ua.includes("mac")) return "macos"
  if (ua.includes("linux")) return "linux"
  return "unknown"
}

function isNetworkMessage(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("reach") ||
    lower.includes("connect")
  )
}

function emptySnapshot(
  status: VerificationStateSnapshot["status"],
  error: string | null = null,
  errorCode: VerificationErrorCode | null = null,
): VerificationStateSnapshot {
  return {
    status,
    verifiedUserId: null,
    verifiedDeviceId: null,
    accessTokenExpiresAt: null,
    lastVerifiedAt: null,
    offlineGraceExpiresAt: null,
    error,
    errorCode,
    verifiedEmail: null,
  }
}

function sessionFromAuth(
  userId: string,
  deviceId: string,
  accessTokenExpiresAt: number,
  email: string | null,
): VerificationSession {
  const timestamp = now()
  return {
    verifiedUserId: userId,
    verifiedDeviceId: deviceId,
    accessTokenExpiresAt,
    lastVerifiedAt: timestamp,
    offlineGraceExpiresAt: timestamp + OFFLINE_GRACE_MS,
    verifiedEmail: email,
  }
}

function snapshotFromSession(session: VerificationSession): VerificationStateSnapshot {
  return {
    status: "verified",
    verifiedUserId: session.verifiedUserId,
    verifiedDeviceId: session.verifiedDeviceId,
    accessTokenExpiresAt: session.accessTokenExpiresAt,
    lastVerifiedAt: session.lastVerifiedAt,
    offlineGraceExpiresAt: session.offlineGraceExpiresAt,
    error: null,
    errorCode: null,
    verifiedEmail: session.verifiedEmail ?? null,
  }
}

async function completeVerification(
  userId: string,
  accessTokenExpiresAt: number,
  email: string | null,
): Promise<VerificationStateSnapshot> {
  const deviceId = await getOrCreateDeviceId()
  const registration = await registerDevice(deviceId, getRuntimeOs(), APP_VERSION)

  if (!registration.ok) {
    if (registration.code === "device_limit_reached") {
      return emptySnapshot(
        "error",
        "This account is already registered on the maximum number of devices (2). Remove a device or contact support.",
        "device_limit_reached",
      )
    }

    if (registration.code === "suspended") {
      return emptySnapshot(
        "error",
        "This account has been suspended. Contact support for assistance.",
        "suspended",
      )
    }

    const message = registration.message ?? "Device registration failed."
    return emptySnapshot(
      "error",
      message,
      isNetworkMessage(message) ? "network" : "unknown",
    )
  }

  const session = sessionFromAuth(userId, deviceId, accessTokenExpiresAt, email)
  await setSessionMetadata(session)
  return snapshotFromSession(session)
}

/**
 * Offline fallback: a session verified online within the grace window keeps
 * working when the network is unreachable. Legacy metadata written before
 * grace existed has offlineGraceExpiresAt = 0; derive the window from
 * lastVerifiedAt instead so those sessions are not locked out either.
 */
async function offlineGraceSnapshot(): Promise<VerificationStateSnapshot | null> {
  const session = await getSessionMetadata()
  if (!session) return null

  const graceExpiresAt =
    session.offlineGraceExpiresAt > 0
      ? session.offlineGraceExpiresAt
      : session.lastVerifiedAt + OFFLINE_GRACE_MS
  if (now() > graceExpiresAt) return null

  return snapshotFromSession(session)
}

export async function loadCachedVerification(): Promise<VerificationStateSnapshot> {
  if (!isTauriRuntime()) return emptySnapshot("required")

  const refreshToken = await getRefreshToken()
  if (!refreshToken) return emptySnapshot("required")

  const restored = await restoreSession()
  if (!restored.ok) {
    if (restored.code === "expired") {
      return emptySnapshot("expired", restored.message)
    }
    if (restored.code === "network") {
      const grace = await offlineGraceSnapshot()
      return grace ?? emptySnapshot("error", restored.message, "network")
    }
    return emptySnapshot("error", restored.message, "unknown")
  }

  const snapshot = await completeVerification(
    restored.userId,
    restored.accessTokenExpiresAt,
    restored.email,
  )
  if (snapshot.status === "error" && snapshot.errorCode === "network") {
    const grace = await offlineGraceSnapshot()
    return grace ?? snapshot
  }
  return snapshot
}

export async function signIn(email: string, password: string): Promise<VerificationStateSnapshot> {
  const result = await signInWithEmail(email, password)
  if (!result.ok) {
    return emptySnapshot("error", result.message, result.code)
  }

  return completeVerification(result.userId, result.accessTokenExpiresAt, result.email)
}

export async function signUp(email: string, password: string): Promise<VerificationStateSnapshot> {
  const result = await signUpWithEmail(email, password)
  if (!result.ok) {
    return emptySnapshot("error", result.message, result.code)
  }

  if (result.needsEmailConfirmation) {
    return emptySnapshot(
      "error",
      "Account created. Check your email to confirm your address, then sign in.",
      "unknown",
    )
  }

  const restored = await restoreSession()
  if (!restored.ok) {
    if (restored.code === "network") {
      return emptySnapshot("error", restored.message, "network")
    }
    return emptySnapshot("error", restored.message, "unknown")
  }

  return completeVerification(restored.userId, restored.accessTokenExpiresAt, restored.email)
}

export async function signOut(): Promise<VerificationStateSnapshot> {
  await supabaseSignOut()
  await clearSessionMetadata()
  return emptySnapshot("required")
}

export async function refreshVerification(): Promise<VerificationStateSnapshot> {
  return loadCachedVerification()
}

export async function clearVerification(): Promise<VerificationStateSnapshot> {
  return signOut()
}

/**
 * Periodic re-registration while the app is running. Returns a blocking
 * snapshot when the account was suspended mid-session; null means no state
 * change (transient network failures never kick an active session).
 */
export async function heartbeatDeviceRegistration(): Promise<VerificationStateSnapshot | null> {
  if (!isTauriRuntime()) return null

  const deviceId = await getOrCreateDeviceId()
  const registration = await registerDevice(deviceId, getRuntimeOs(), APP_VERSION)

  if (!registration.ok && registration.code === "suspended") {
    await clearSessionMetadata()
    return emptySnapshot(
      "error",
      "This account has been suspended. Contact support for assistance.",
      "suspended",
    )
  }

  return null
}
