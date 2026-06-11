import { getSupabaseClient } from "@/lib/supabase/client"

export interface AdminAccountRow {
  user_id: string
  email: string | null
  created_at: string
  suspended: boolean
  suspend_reason: string | null
  device_count: number
  last_seen_at: string | null
  is_admin: boolean
}

export type AccountActionResult = { ok: true } | { ok: false; message: string }

function failureMessage(error: { message?: string } | null, fallback: string): string {
  return error?.message?.trim() ? error.message : fallback
}

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
      return { ok: false, message: failureMessage(error, "Account deletion failed.") }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: "Unable to reach the account service." }
  }
}

export async function adminListAccounts(): Promise<
  { ok: true; accounts: AdminAccountRow[] } | { ok: false; message: string }
> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc("admin_list_accounts")
    if (error) {
      return { ok: false, message: failureMessage(error, "Could not load accounts.") }
    }
    return { ok: true, accounts: (data ?? []) as AdminAccountRow[] }
  } catch {
    return { ok: false, message: "Unable to reach the account service." }
  }
}

export async function adminSetSuspended(
  userId: string,
  suspended: boolean,
  reason?: string,
): Promise<AccountActionResult> {
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.rpc("admin_set_suspended", {
      p_user_id: userId,
      p_suspended: suspended,
      p_reason: reason ?? null,
    })
    if (error) {
      return { ok: false, message: failureMessage(error, "Suspension update failed.") }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: "Unable to reach the account service." }
  }
}

export async function adminDeleteAccount(userId: string): Promise<AccountActionResult> {
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.rpc("admin_delete_account", { p_user_id: userId })
    if (error) {
      return { ok: false, message: failureMessage(error, "Account deletion failed.") }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: "Unable to reach the account service." }
  }
}
