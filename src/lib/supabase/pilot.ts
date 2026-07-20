import { callRpc } from "@/lib/supabase/rpc"

export type PilotStatus = "draft" | "active" | "suspended" | "expired"
export type PilotRole = "primary_contact" | "pastor" | "operator"

export interface PilotChurch {
  id: string
  name: string
  primary_contact_name: string | null
  primary_contact_email: string | null
  district_pastor: string | null
  status: "active" | "replaced"
}

export interface PilotInvite {
  id: string
  church_id: string
  role: PilotRole
  expires_at: string
  redeemed_at: string | null
  revoked_at: string | null
}

export interface PilotMembership {
  user_id: string
  church_id: string
  email: string | null
  role: PilotRole
  status: "active" | "revoked"
  training_acknowledged_at: string
}

export interface PilotAdminState {
  id: string
  name: string
  status: PilotStatus
  commencement_date: string | null
  expiry_date: string | null
  payment_confirmed_at: string | null
  onboarding_started_at: string | null
  max_active_churches: number
  max_devices_per_church: number
  max_pilot_devices: number
  churches: PilotChurch[]
  invites: PilotInvite[]
  memberships: PilotMembership[]
}

export type PilotActionResult = { ok: true } | { ok: false; message: string }

const PILOT_CATCH = "Unable to reach the pilot service."
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (byte) => INVITE_ALPHABET[byte % INVITE_ALPHABET.length]).join("")
}

export async function redeemPilotInvite(
  code: string,
  trainingAcknowledged: boolean
): Promise<PilotActionResult> {
  const result = await callRpc<{ status?: string }>("redeem_pilot_invite", {
    args: {
      p_code: code,
      p_training_acknowledged: trainingAcknowledged,
    },
    errorFallback: "Invitation redemption failed.",
    catchFallback: PILOT_CATCH,
  })
  if (!result.ok) return { ok: false, message: result.message }
  if (result.data.status === "ok" || result.data.status === "admin") return { ok: true }
  if (result.data.status === "training_required") {
    return { ok: false, message: "Confirm that you completed or reviewed the training." }
  }
  if (result.data.status === "email_confirmation_required") {
    return { ok: false, message: "Confirm your email address before using an invitation." }
  }
  if (result.data.status === "already_redeemed") {
    return { ok: false, message: "This account already belongs to a pilot church." }
  }
  return { ok: false, message: "This invitation code is invalid, expired, used, or revoked." }
}

export async function adminGetPilot(): Promise<
  { ok: true; pilot: PilotAdminState } | { ok: false; message: string }
> {
  const result = await callRpc<PilotAdminState>("admin_get_pilot", {
    errorFallback: "Could not load the KNFC pilot.",
    catchFallback: PILOT_CATCH,
  })
  return result.ok
    ? { ok: true, pilot: result.data }
    : { ok: false, message: result.message }
}

export async function adminUpdatePilot(input: {
  status: PilotStatus
  commencementDate: string | null
  expiryDate: string | null
  paymentConfirmed: boolean
  onboardingStarted: boolean
  maxActiveChurches: number
  maxDevicesPerChurch: number
  maxPilotDevices: number
}): Promise<PilotActionResult> {
  const result = await callRpc<null>("admin_update_pilot", {
    args: {
      p_status: input.status,
      p_commencement_date: input.commencementDate,
      p_expiry_date: input.expiryDate,
      p_payment_confirmed: input.paymentConfirmed,
      p_onboarding_started: input.onboardingStarted,
      p_max_active_churches: input.maxActiveChurches,
      p_max_devices_per_church: input.maxDevicesPerChurch,
      p_max_pilot_devices: input.maxPilotDevices,
    },
    errorFallback: "Pilot update failed.",
    catchFallback: PILOT_CATCH,
  })
  return result.ok ? { ok: true } : { ok: false, message: result.message }
}

export async function adminAddPilotChurch(input: {
  name: string
  primaryContactName: string
  primaryContactEmail: string
  districtPastor: string
}): Promise<PilotActionResult> {
  const result = await callRpc<string>("admin_add_pilot_church", {
    args: {
      p_name: input.name,
      p_primary_contact_name: input.primaryContactName,
      p_primary_contact_email: input.primaryContactEmail,
      p_district_pastor: input.districtPastor,
    },
    errorFallback: "Church creation failed.",
    catchFallback: PILOT_CATCH,
  })
  return result.ok ? { ok: true } : { ok: false, message: result.message }
}

export async function adminSetPilotChurchStatus(
  churchId: string,
  status: "active" | "replaced"
): Promise<PilotActionResult> {
  const result = await callRpc<null>("admin_set_pilot_church_status", {
    args: { p_church_id: churchId, p_status: status },
    errorFallback: "Church status update failed.",
    catchFallback: PILOT_CATCH,
  })
  return result.ok ? { ok: true } : { ok: false, message: result.message }
}

export async function adminRevokePilotMembership(userId: string): Promise<PilotActionResult> {
  const result = await callRpc<null>("admin_revoke_pilot_membership", {
    args: { p_user_id: userId },
    errorFallback: "Membership revocation failed.",
    catchFallback: PILOT_CATCH,
  })
  return result.ok ? { ok: true } : { ok: false, message: result.message }
}

export async function adminCreatePilotInvite(
  churchId: string,
  role: PilotRole,
  expiresAt: string
): Promise<{ ok: true; code: string } | { ok: false; message: string }> {
  const code = generateInviteCode()
  const result = await callRpc<string>("admin_create_pilot_invite", {
    args: {
      p_church_id: churchId,
      p_role: role,
      p_code: code,
      p_expires_at: expiresAt,
    },
    errorFallback: "Invitation creation failed.",
    catchFallback: PILOT_CATCH,
  })
  return result.ok ? { ok: true, code } : { ok: false, message: result.message }
}

export async function adminRevokePilotInvite(inviteId: string): Promise<PilotActionResult> {
  const result = await callRpc<null>("admin_revoke_pilot_invite", {
    args: { p_invite_id: inviteId },
    errorFallback: "Invitation revocation failed.",
    catchFallback: PILOT_CATCH,
  })
  return result.ok ? { ok: true } : { ok: false, message: result.message }
}
