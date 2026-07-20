import packageJson from "../../../package.json"
import { callRpc } from "@/lib/supabase/rpc"
import { getSupabaseClient } from "@/lib/supabase/client"
import {
  getOrCreateInstallationIdentity,
  signInstallationChallenge,
} from "@/lib/verification/device-id"
import type { SignedActivationLease } from "@/lib/verification/activation-lease"

export type RegisterDeviceResult =
  | {
      ok: true
      accessExpiresAt: number | null
      isChurchOrganization: boolean
      churchName: string | null
      lease: SignedActivationLease
    }
  | { ok: false; code: "device_limit_reached" }
  | { ok: false; code: "device_pending" }
  | { ok: false; code: "device_revoked" }
  | { ok: false; code: "device_identity_mismatch" }
  | { ok: false; code: "suspended" }
  | { ok: false; code: "trial_expired" }
  | { ok: false; code: "invite_required" }
  | { ok: false; code: "pilot_inactive" }
  | { ok: false; code: "error"; message: string }

type RegisterDeviceStatusResult =
  | Omit<Extract<RegisterDeviceResult, { ok: true }>, "lease">
  | Exclude<RegisterDeviceResult, { ok: true }>

const DEVICE_CATCH = "Unable to reach the device registration service."

export type DeviceActivationStatus = "pending" | "approved" | "revoked"

export interface DeviceActivation {
  deviceId: string
  os: string | null
  appVersion: string | null
  label: string | null
  status: DeviceActivationStatus
  firstSeenAt: string
  lastSeenAt: string
  approvedAt: string | null
  revokedAt: string | null
}

export type DeviceActionResult =
  | { ok: true }
  | { ok: false; message: string }

function parseRegisterDeviceStatus(data: unknown): RegisterDeviceStatusResult {
  if (!data || typeof data !== "object") {
    return {
      ok: false,
      code: "error",
      message: "Unexpected device registration response.",
    }
  }

  const status = (data as { status?: unknown }).status
  if (status === "ok") {
    const rawExpiry = (data as { access_expires_at?: unknown })
      .access_expires_at
    const accessExpiresAt =
      typeof rawExpiry === "string" ? Date.parse(rawExpiry) : null
    return {
      ok: true,
      accessExpiresAt: Number.isFinite(accessExpiresAt)
        ? accessExpiresAt
        : null,
      isChurchOrganization:
        (data as { is_church_organization?: unknown })
          .is_church_organization === true,
      churchName:
        typeof (data as { church_name?: unknown }).church_name === "string"
          ? (data as { church_name: string }).church_name
          : null,
    }
  }
  if (status === "device_limit_reached")
    return { ok: false, code: "device_limit_reached" }
  if (status === "device_pending")
    return { ok: false, code: "device_pending" }
  if (status === "device_revoked")
    return { ok: false, code: "device_revoked" }
  if (status === "device_identity_mismatch")
    return { ok: false, code: "device_identity_mismatch" }
  if (status === "suspended") return { ok: false, code: "suspended" }
  if (status === "trial_expired") return { ok: false, code: "trial_expired" }
  if (status === "invite_required") return { ok: false, code: "invite_required" }
  if (status === "pilot_inactive") return { ok: false, code: "pilot_inactive" }

  return {
    ok: false,
    code: "error",
    message: "Unexpected device registration response.",
  }
}

function parseDeviceActivation(value: unknown): DeviceActivation | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (
    typeof row.device_id !== "string" ||
    !["pending", "approved", "revoked"].includes(String(row.status)) ||
    typeof row.first_seen_at !== "string" ||
    typeof row.last_seen_at !== "string"
  ) {
    return null
  }
  const nullableString = (candidate: unknown): string | null =>
    typeof candidate === "string" ? candidate : null
  return {
    deviceId: row.device_id,
    os: nullableString(row.os),
    appVersion: nullableString(row.app_version),
    label: nullableString(row.label),
    status: row.status as DeviceActivationStatus,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    approvedAt: nullableString(row.approved_at),
    revokedAt: nullableString(row.revoked_at),
  }
}

async function listDevices(
  rpcName: "list_own_devices" | "admin_list_devices",
  args?: Record<string, unknown>
): Promise<
  { ok: true; devices: DeviceActivation[] } | { ok: false; message: string }
> {
  const result = await callRpc<unknown>(rpcName, {
    args,
    errorFallback: "Could not load activated computers.",
    catchFallback: DEVICE_CATCH,
  })
  if (!result.ok) return { ok: false, message: result.message }
  const devices = Array.isArray(result.data)
    ? result.data
        .map(parseDeviceActivation)
        .filter((device): device is DeviceActivation => device !== null)
    : []
  return { ok: true, devices }
}

export function listOwnDevices() {
  return listDevices("list_own_devices")
}

export function adminListDevices(userId: string) {
  return listDevices("admin_list_devices", { p_user_id: userId })
}

export async function deactivateOwnDevice(
  deviceId: string
): Promise<DeviceActionResult> {
  const result = await callRpc<null>("deactivate_own_device", {
    args: { p_device_id: deviceId },
    errorFallback: "Computer deactivation failed.",
    catchFallback: DEVICE_CATCH,
  })
  return result.ok ? { ok: true } : { ok: false, message: result.message }
}

export async function adminSetDeviceStatus(
  userId: string,
  deviceId: string,
  status: "approved" | "revoked"
): Promise<DeviceActionResult> {
  const result = await callRpc<null>("admin_set_device_status", {
    args: {
      p_user_id: userId,
      p_device_id: deviceId,
      p_status: status,
    },
    errorFallback: "Computer activation update failed.",
    catchFallback: DEVICE_CATCH,
  })
  return result.ok ? { ok: true } : { ok: false, message: result.message }
}

export async function approveOwnDevice(
  userId: string,
  targetDeviceId: string
): Promise<DeviceActionResult> {
  try {
    const identity = await getOrCreateInstallationIdentity()
    if (!identity.publicKey) {
      return { ok: false, message: "A desktop installation identity is required." }
    }
    const challengeTimestamp = Date.now()
    const challenge = [
      "approve",
      userId,
      identity.deviceId,
      targetDeviceId,
      challengeTimestamp,
      packageJson.version,
    ].join("|")
    const signature = await signInstallationChallenge(challenge)
    if (!signature) return { ok: false, message: "Could not sign approval request." }
    const { data, error } = await getSupabaseClient().functions.invoke(
      "device-activation",
      {
        body: {
          action: "approve",
          userId,
          deviceId: identity.deviceId,
          targetDeviceId,
          publicKey: identity.publicKey,
          challengeTimestamp,
          signature,
          os: "desktop",
          appVersion: packageJson.version,
        },
      }
    )
    if (error) return { ok: false, message: error.message || DEVICE_CATCH }
    return (data as { status?: unknown } | null)?.status === "approved"
      ? { ok: true }
      : { ok: false, message: "Computer approval was not confirmed." }
  } catch {
    return { ok: false, message: DEVICE_CATCH }
  }
}

export async function registerDevice(
  userId: string,
  deviceId: string,
  os: string,
  appVersion: string,
  publicKey: string | null,
  label?: string
): Promise<RegisterDeviceResult> {
  if (!publicKey) {
    return {
      ok: false,
      code: "error",
      message: "A desktop installation identity is required.",
    }
  }
  const challengeTimestamp = Date.now()
  const challenge = [
    "register",
    userId,
    deviceId,
    "",
    challengeTimestamp,
    appVersion,
  ].join("|")
  try {
    const signature = await signInstallationChallenge(challenge)
    if (!signature) {
      return {
        ok: false,
        code: "error",
        message: "Could not sign the installation activation request.",
      }
    }
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.functions.invoke(
      "device-activation",
      {
        body: {
          action: "register",
          userId,
          deviceId,
          publicKey,
          challengeTimestamp,
          signature,
          os,
          appVersion,
          label: label ?? null,
        },
      }
    )
    if (error) {
      return { ok: false, code: "error", message: error.message || DEVICE_CATCH }
    }
    const envelope = data as {
      registration?: unknown
      lease?: { payload?: unknown; signature?: unknown }
      message?: unknown
    } | null
    const registration = parseRegisterDeviceStatus(envelope?.registration)
    if (!registration.ok) return registration
    if (
      typeof envelope?.lease?.payload !== "string" ||
      typeof envelope.lease.signature !== "string"
    ) {
      return {
        ok: false,
        code: "error",
        message: "The activation service did not return a signed offline lease.",
      }
    }
    return {
      ...registration,
      lease: {
        payload: envelope.lease.payload,
        signature: envelope.lease.signature,
      },
    }
  } catch {
    return { ok: false, code: "error", message: DEVICE_CATCH }
  }
}
