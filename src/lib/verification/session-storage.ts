import { load, type Store } from "@tauri-apps/plugin-store"
import { invokeTauri, isTauriRuntime } from "@/lib/tauri-runtime"
import type { VerificationSession } from "@/types/verification"

const STORE_FILE = "verification.json"
const METADATA_KEY = "metadata"

let storePromise: Promise<Store> | null = null

function getStore(): Promise<Store> {
  storePromise ??= load(STORE_FILE, { autoSave: false, defaults: {} })
  return storePromise
}

export function resetSessionStorageForTests(): void {
  storePromise = null
}

function normalizeSession(value: unknown): VerificationSession | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.verifiedUserId !== "string" ||
    typeof candidate.verifiedDeviceId !== "string" ||
    typeof candidate.accessTokenExpiresAt !== "number" ||
    typeof candidate.lastVerifiedAt !== "number" ||
    typeof candidate.offlineGraceExpiresAt !== "number"
  ) {
    return null
  }

  const accessExpiresAt =
    typeof candidate.accessExpiresAt === "number" &&
    Number.isFinite(candidate.accessExpiresAt)
      ? candidate.accessExpiresAt
      : null

  return {
    verifiedUserId: candidate.verifiedUserId,
    verifiedDeviceId: candidate.verifiedDeviceId,
    accessTokenExpiresAt: candidate.accessTokenExpiresAt,
    lastVerifiedAt: candidate.lastVerifiedAt,
    offlineGraceExpiresAt: candidate.offlineGraceExpiresAt,
    accessExpiresAt,
    verifiedEmail:
      typeof candidate.verifiedEmail === "string"
        ? candidate.verifiedEmail
        : null,
    isChurchOrganization: candidate.isChurchOrganization === true,
    churchName:
      typeof candidate.churchName === "string" ? candidate.churchName : null,
    activationLease:
      candidate.activationLease &&
      typeof candidate.activationLease === "object" &&
      typeof (candidate.activationLease as Record<string, unknown>).payload ===
        "string" &&
      typeof (candidate.activationLease as Record<string, unknown>).signature ===
        "string"
        ? (candidate.activationLease as VerificationSession["activationLease"])
        : null,
  }
}

export async function getRefreshToken(): Promise<string | null> {
  if (!isTauriRuntime()) return null

  const token = await invokeTauri<string>("get_verification_token")
  if (!token || token.trim() === "") return null
  return token
}

export async function setRefreshToken(token: string): Promise<void> {
  if (!isTauriRuntime()) return

  if (!token.trim()) {
    throw new Error("Refresh token cannot be empty.")
  }

  await invokeTauri("set_verification_token", { value: token })
}

export async function clearToken(): Promise<void> {
  if (!isTauriRuntime()) return

  await invokeTauri("clear_verification_token").catch((error) => {
    console.warn("[session-storage] clear verification token failed", error)
  })
}

export async function getSessionMetadata(): Promise<VerificationSession | null> {
  if (!isTauriRuntime()) return null

  const store = await getStore()
  const metadata = await store.get<VerificationSession>(METADATA_KEY)
  return normalizeSession(metadata)
}

export async function setSessionMetadata(
  session: VerificationSession
): Promise<void> {
  if (!isTauriRuntime()) return

  const store = await getStore()
  await store.set(METADATA_KEY, session)
  await store.save()
}

export async function clearSessionMetadata(): Promise<void> {
  if (!isTauriRuntime()) return

  const store = await getStore()
  await store.delete(METADATA_KEY)
  await store.save()
}
