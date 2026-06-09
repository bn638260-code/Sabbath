import { load, type Store } from "@tauri-apps/plugin-store"
import { invokeTauri, isTauriRuntime } from "@/lib/tauri-runtime"
import type { VerificationSession, VerificationStateSnapshot } from "@/types/verification"

const STORE_FILE = "verification.json"
const METADATA_KEY = "metadata"
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000
const OFFLINE_GRACE_MS = 3 * 24 * 60 * 60 * 1000

let storePromise: Promise<Store> | null = null

function now(): number {
  return Date.now()
}

function getStore(): Promise<Store> {
  storePromise ??= load(STORE_FILE, { autoSave: false, defaults: {} })
  return storePromise
}

function createMockSession(): VerificationSession {
  const timestamp = now()
  const deviceSeed =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(timestamp)

  return {
    verifiedUserId: "creator-local",
    verifiedDeviceId: `device-${deviceSeed}`,
    accessTokenExpiresAt: timestamp + SESSION_DURATION_MS,
    lastVerifiedAt: timestamp,
    offlineGraceExpiresAt: timestamp + SESSION_DURATION_MS + OFFLINE_GRACE_MS,
  }
}

function emptySnapshot(status: VerificationStateSnapshot["status"]): VerificationStateSnapshot {
  return {
    status,
    verifiedUserId: null,
    verifiedDeviceId: null,
    accessTokenExpiresAt: null,
    lastVerifiedAt: null,
    offlineGraceExpiresAt: null,
    error: null,
  }
}

function snapshotFromSession(session: VerificationSession): VerificationStateSnapshot {
  const timestamp = now()
  const status =
    session.accessTokenExpiresAt > timestamp
      ? "verified"
      : session.offlineGraceExpiresAt > timestamp
        ? "grace"
        : "expired"

  return {
    status,
    verifiedUserId: session.verifiedUserId,
    verifiedDeviceId: session.verifiedDeviceId,
    accessTokenExpiresAt: session.accessTokenExpiresAt,
    lastVerifiedAt: session.lastVerifiedAt,
    offlineGraceExpiresAt: session.offlineGraceExpiresAt,
    error: null,
  }
}

function isSession(value: unknown): value is VerificationSession {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.verifiedUserId === "string" &&
    typeof candidate.verifiedDeviceId === "string" &&
    typeof candidate.accessTokenExpiresAt === "number" &&
    typeof candidate.lastVerifiedAt === "number" &&
    typeof candidate.offlineGraceExpiresAt === "number"
  )
}

async function hasKeychainToken(): Promise<boolean> {
  if (!isTauriRuntime()) return false
  return invokeTauri<boolean>("has_verification_token").catch(() => false)
}

async function saveMetadata(session: VerificationSession): Promise<void> {
  if (!isTauriRuntime()) return
  const store = await getStore()
  await store.set(METADATA_KEY, session)
  await store.save()
}

export async function loadCachedVerification(): Promise<VerificationStateSnapshot> {
  if (!isTauriRuntime()) return emptySnapshot("required")

  const [store, hasToken] = await Promise.all([getStore(), hasKeychainToken()])
  if (!hasToken) return emptySnapshot("required")

  const metadata = await store.get<VerificationSession>(METADATA_KEY)
  if (!isSession(metadata)) return emptySnapshot("required")
  return snapshotFromSession(metadata)
}

export async function verifyDevice(): Promise<VerificationStateSnapshot> {
  const session = createMockSession()

  if (isTauriRuntime()) {
    await invokeTauri<string>("rotate_verification_token")
    await saveMetadata(session)
  }

  return snapshotFromSession(session)
}

export async function refreshVerification(): Promise<VerificationStateSnapshot> {
  const cached = await loadCachedVerification()
  if (cached.status === "verified" || cached.status === "grace") return cached
  return verifyDevice()
}

export async function clearVerification(): Promise<VerificationStateSnapshot> {
  if (isTauriRuntime()) {
    await invokeTauri("clear_verification_token").catch((error) => {
      console.warn("[verification] clear verification token failed", error)
    })
    const store = await getStore()
    await store.delete(METADATA_KEY)
    await store.save()
  }
  return emptySnapshot("required")
}
