import { callRpc } from "@/lib/supabase/rpc"

export interface AdminAccountRow {
  user_id: string
  email: string | null
  created_at: string
  suspended: boolean
  suspend_reason: string | null
  access_expires_at: string | null
  device_count: number
  last_seen_at: string | null
  is_admin: boolean
  is_church_organization: boolean
  church_name: string | null
  offline_lease_hours: number
}

export type AccountActionResult = { ok: true } | { ok: false; message: string }

const ACCOUNT_CATCH = "Unable to reach the account service."

/** Whether the signed-in user may use the admin dashboard. */
export async function fetchIsAdmin(): Promise<boolean> {
  const result = await callRpc<boolean>("is_app_admin", {
    errorFallback: "",
    catchFallback: ACCOUNT_CATCH,
  })
  return result.ok && result.data === true
}

/** Permanently delete the signed-in user's own account. */
export async function deleteOwnAccount(): Promise<AccountActionResult> {
  const result = await callRpc<null>("delete_own_account", {
    errorFallback: "Account deletion failed.",
    catchFallback: ACCOUNT_CATCH,
  })
  if (!result.ok) return { ok: false, message: result.message }
  return { ok: true }
}

function isAdminAccountRow(value: unknown): value is AdminAccountRow {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return (
    typeof row.user_id === "string" &&
    typeof row.suspended === "boolean" &&
    typeof row.device_count === "number" &&
    typeof row.is_admin === "boolean" &&
    typeof row.is_church_organization === "boolean" &&
    (row.church_name === null || typeof row.church_name === "string")
    && typeof row.offline_lease_hours === "number"
  )
}

export async function adminListAccounts(): Promise<
  { ok: true; accounts: AdminAccountRow[] } | { ok: false; message: string }
> {
  const result = await callRpc<unknown>("admin_list_accounts", {
    errorFallback: "Could not load accounts.",
    catchFallback: ACCOUNT_CATCH,
  })
  if (!result.ok) return { ok: false, message: result.message }
  const accounts = Array.isArray(result.data)
    ? result.data.filter(isAdminAccountRow)
    : []
  return { ok: true, accounts }
}

export async function adminSetSuspended(
  userId: string,
  suspended: boolean,
  reason?: string
): Promise<AccountActionResult> {
  const result = await callRpc<null>("admin_set_suspended", {
    args: {
      p_user_id: userId,
      p_suspended: suspended,
      p_reason: reason ?? null,
    },
    errorFallback: "Suspension update failed.",
    catchFallback: ACCOUNT_CATCH,
  })
  if (!result.ok) return { ok: false, message: result.message }
  return { ok: true }
}

export async function adminSetAccess(
  userId: string,
  days: number
): Promise<AccountActionResult> {
  const result = await callRpc<null>("admin_set_access", {
    args: { p_user_id: userId, p_days: days },
    errorFallback: "Access update failed.",
    catchFallback: ACCOUNT_CATCH,
  })
  if (!result.ok) return { ok: false, message: result.message }
  return { ok: true }
}

export async function adminSetOfflineLeaseHours(
  userId: string,
  hours: 24 | 72 | 168
): Promise<AccountActionResult> {
  const result = await callRpc<null>("admin_set_offline_lease_hours", {
    args: { p_user_id: userId, p_hours: hours },
    errorFallback: "Offline lease update failed.",
    catchFallback: ACCOUNT_CATCH,
  })
  return result.ok ? { ok: true } : { ok: false, message: result.message }
}

export async function adminDeleteAccount(
  userId: string
): Promise<AccountActionResult> {
  const result = await callRpc<null>("admin_delete_account", {
    args: { p_user_id: userId },
    errorFallback: "Account deletion failed.",
    catchFallback: ACCOUNT_CATCH,
  })
  if (!result.ok) return { ok: false, message: result.message }
  return { ok: true }
}

export async function requestAccountCancellation(
  accountEmail?: string | null
): Promise<AccountActionResult> {
  const result = await callRpc<null>("request_account_cancellation", {
    args: { p_account_email: accountEmail ?? null },
    errorFallback: "Cancellation request failed.",
    catchFallback: ACCOUNT_CATCH,
  })
  if (!result.ok) return { ok: false, message: result.message }
  return { ok: true }
}
