import { load, type Store } from "@tauri-apps/plugin-store"
import { isTauriRuntime } from "@/lib/tauri-runtime"

const STORE_FILE = "verification.json"
const DEVICE_ID_KEY = "deviceId"

let storePromise: Promise<Store> | null = null

function getStore(): Promise<Store> {
  storePromise ??= load(STORE_FILE, { autoSave: false, defaults: {} })
  return storePromise
}

export function resetDeviceIdStoreForTests(): void {
  storePromise = null
}

export async function getOrCreateDeviceId(): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error("Device ID is unavailable outside the desktop runtime.")
  }

  const store = await getStore()
  const existing = await store.get<string>(DEVICE_ID_KEY)
  if (typeof existing === "string" && existing.trim() !== "") {
    return existing
  }

  const deviceId = crypto.randomUUID()
  await store.set(DEVICE_ID_KEY, deviceId)
  await store.save()
  return deviceId
}
