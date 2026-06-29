import { getSupabaseClient } from "@/lib/supabase/client"
import { failureMessage } from "@/lib/supabase/errors"

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
}

export type AccountActionResult = { ok: true } | { ok: false; message: string }

/** Whether the signed-in user may use the admin dashboard. */
export async function fetchIsAdmin(): Promise<boolean> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc("is_app_admin")
    if (error) return false
    return data === true
  } catch {
    return false
  }
}

/** Permanently delete the signed-in user's own account. */
export async function deleteOwnAccount(): Promise<AccountActionResult> {
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.rpc("delete_own_account")
    if (error) {
      return {
        ok: false,
        message: failureMessage(error, "Account deletion failed."),
      }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: "Unable to reach the account service." }
  }
}

function isAdminAccountRow(value: unknown): value is AdminAccountRow {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return (
    typeof row.user_id === "string" &&
    typeof row.suspended === "boolean" &&
    typeof row.device_count === "number" &&
    typeof row.is_admin === "boolean"
  )
}

export async function adminListAccounts(): Promise<
  { ok: true; accounts: AdminAccountRow[] } | { ok: false; message: string }
> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc("admin_list_accounts")
    if (error) {
      return {
        ok: false,
        message: failureMessage(error, "Could not load accounts."),
      }
    }
    const accounts = Array.isArray(data) ? data.filter(isAdminAccountRow) : []
    return { ok: true, accounts }
  } catch {
    return { ok: false, message: "Unable to reach the account service." }
  }
}

export async function adminSetSuspended(
  userId: string,
  suspended: boolean,
  reason?: string
): Promise<AccountActionResult> {
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.rpc("admin_set_suspended", {
      p_user_id: userId,
      p_suspended: suspended,
      p_reason: reason ?? null,
    })
    if (error) {
      return {
        ok: false,
        message: failureMessage(error, "Suspension update failed."),
      }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: "Unable to reach the account service." }
  }
}

export async function adminSetAccess(
  userId: string,
  days: number
): Promise<AccountActionResult> {
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.rpc("admin_set_access", {
      p_user_id: userId,
      p_days: days,
    })
    if (error) {
      return {
        ok: false,
        message: failureMessage(error, "Access update failed."),
      }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: "Unable to reach the account service." }
  }
}

export async function adminDeleteAccount(
  userId: string
): Promise<AccountActionResult> {
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.rpc("admin_delete_account", {
      p_user_id: userId,
    })
    if (error) {
      return {
        ok: false,
        message: failureMessage(error, "Account deletion failed."),
      }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: "Unable to reach the account service." }
  }
}

export async function requestAccountCancellation(
  accountEmail?: string | null
): Promise<AccountActionResult> {
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.rpc("request_account_cancellation", {
      p_account_email: accountEmail ?? null,
    })
    if (error) {
      return {
        ok: false,
        message: failureMessage(error, "Cancellation request failed."),
      }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: "Unable to reach the account service." }
  }
}
