import { load, type Store } from "@tauri-apps/plugin-store"
import { invokeTauri, isTauriRuntime } from "@/lib/tauri-runtime"

const STORE_FILE = "verification.json"
const DEVICE_ID_KEY = "deviceId"
const BROWSER_DEVICE_ID_KEY = "sabbathcue.browserDeviceId"

let storePromise: Promise<Store> | null = null
let identityPromise: Promise<InstallationIdentity> | null = null

export interface InstallationIdentity {
  deviceId: string
  publicKey: string | null
}

function getStore(): Promise<Store> {
  storePromise ??= load(STORE_FILE, { autoSave: false, defaults: {} })
  return storePromise
}

export function resetDeviceIdStoreForTests(): void {
  storePromise = null
  identityPromise = null
}

function createDeviceId(): string {
  return crypto.randomUUID()
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getOrCreateBrowserDeviceId(): string {
  const storage = getBrowserStorage()
  let existing: string | null = null
  try {
    existing = storage?.getItem(BROWSER_DEVICE_ID_KEY) ?? null
  } catch {
    existing = null
  }

  if (existing?.trim()) return existing

  const deviceId = createDeviceId()
  try {
    storage?.setItem(BROWSER_DEVICE_ID_KEY, deviceId)
  } catch {
    // Browser dev can still complete the current auth attempt without persistence.
  }
  return deviceId
}

export async function getOrCreateDeviceId(): Promise<string> {
  return (await getOrCreateInstallationIdentity()).deviceId
}

export function getOrCreateInstallationIdentity(): Promise<InstallationIdentity> {
  identityPromise ??= loadInstallationIdentity()
  return identityPromise
}

async function loadInstallationIdentity(): Promise<InstallationIdentity> {
  if (!isTauriRuntime()) {
    return { deviceId: getOrCreateBrowserDeviceId(), publicKey: null }
  }

  const store = await getStore()
  const existing = await store.get<string>(DEVICE_ID_KEY)
  if (typeof existing === "string" && existing.trim() !== "") {
    await invokeTauri("adopt_installation_device_id", { deviceId: existing })
  }

  const identity = await invokeTauri<InstallationIdentity>(
    "get_or_create_installation_identity"
  )
  if (!existing?.trim()) {
    await store.set(DEVICE_ID_KEY, identity.deviceId)
    await store.save()
  }
  return identity
}

export async function signInstallationChallenge(
  challenge: string
): Promise<string | null> {
  if (!isTauriRuntime()) return null
  return invokeTauri<string>("sign_installation_challenge", { challenge })
}
