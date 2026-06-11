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
  if (!isSession(metadata)) return null
  return metadata
}

export async function setSessionMetadata(session: VerificationSession): Promise<void> {
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
