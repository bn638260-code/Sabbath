import { getSupabaseClient } from "@/lib/supabase/client"

export type RegisterDeviceResult =
  | { ok: true }
  | { ok: false; code: "device_limit_reached" }
  | { ok: false; code: "error"; message: string }

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("networkerror")
  )
}

function parseRegisterDeviceStatus(data: unknown): RegisterDeviceResult {
  if (!data || typeof data !== "object") {
    return { ok: false, code: "error", message: "Unexpected device registration response." }
  }

  const status = (data as { status?: unknown }).status
  if (status === "ok") return { ok: true }
  if (status === "device_limit_reached") return { ok: false, code: "device_limit_reached" }

  return { ok: false, code: "error", message: "Unexpected device registration response." }
}

export async function registerDevice(
  deviceId: string,
  os: string,
  appVersion: string,
  label?: string,
): Promise<RegisterDeviceResult> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc("register_device", {
      p_device_id: deviceId,
      p_os: os,
      p_app_version: appVersion,
      p_label: label ?? null,
    })

    if (error) {
      if (isNetworkError(error)) {
        return { ok: false, code: "error", message: "Unable to reach the device registration service." }
      }
      return { ok: false, code: "error", message: error.message || "Device registration failed." }
    }

    return parseRegisterDeviceStatus(data)
  } catch (error) {
    if (isNetworkError(error)) {
      return { ok: false, code: "error", message: "Unable to reach the device registration service." }
    }
    return { ok: false, code: "error", message: "Device registration failed." }
  }
}
