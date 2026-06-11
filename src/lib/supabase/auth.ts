import { getSupabaseClient } from "@/lib/supabase/client"
import {
  clearToken,
  getRefreshToken,
  setRefreshToken,
} from "@/lib/verification/session-storage"

export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "network"
  | "unknown"

export type SignUpResult =
  | {
      ok: true
      needsEmailConfirmation: false
      userId: string
      email: string | null
      refreshToken: string
    }
  | { ok: true; needsEmailConfirmation: true }
  | { ok: false; code: AuthErrorCode; message: string }

export type SignInResult =
  | {
      ok: true
      userId: string
      email: string | null
      refreshToken: string
      accessTokenExpiresAt: number
    }
  | { ok: false; code: AuthErrorCode; message: string }

export type RestoreSessionResult =
  | {
      ok: true
      userId: string
      email: string | null
      refreshToken: string
      accessTokenExpiresAt: number
    }
  | { ok: false; code: "expired" | "network" | "unknown"; message: string }

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

function mapAuthError(error: { message?: string; status?: number }): AuthErrorCode {
  const message = (error.message ?? "").toLowerCase()
  if (message.includes("email not confirmed") || message.includes("email_not_confirmed")) {
    return "email_not_confirmed"
  }
  if (
    error.status === 400 ||
    error.status === 401 ||
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials")
  ) {
    return "invalid_credentials"
  }
  return "unknown"
}

function accessTokenExpiresAt(expiresAt: number | undefined): number {
  if (typeof expiresAt === "number" && Number.isFinite(expiresAt)) {
    return expiresAt * 1000
  }
  return Date.now() + 60 * 60 * 1000
}

export async function signUpWithEmail(email: string, password: string): Promise<SignUpResult> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      if (isNetworkError(error)) {
        return { ok: false, code: "network", message: "Unable to reach the authentication service." }
      }
      return {
        ok: false,
        code: mapAuthError(error),
        message: error.message || "Sign up failed.",
      }
    }

    if (!data.session?.refresh_token || !data.user?.id) {
      return { ok: true, needsEmailConfirmation: true }
    }

    await setRefreshToken(data.session.refresh_token)

    return {
      ok: true,
      needsEmailConfirmation: false,
      userId: data.user.id,
      email: data.user.email ?? null,
      refreshToken: data.session.refresh_token,
    }
  } catch (error) {
    if (isNetworkError(error)) {
      return { ok: false, code: "network", message: "Unable to reach the authentication service." }
    }
    return { ok: false, code: "unknown", message: "Sign up failed." }
  }
}

export async function signInWithEmail(email: string, password: string): Promise<SignInResult> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      if (isNetworkError(error)) {
        return { ok: false, code: "network", message: "Unable to reach the authentication service." }
      }
      return {
        ok: false,
        code: mapAuthError(error),
        message: error.message || "Sign in failed.",
      }
    }

    const refreshToken = data.session?.refresh_token
    const userId = data.user?.id
    if (!refreshToken || !userId) {
      return { ok: false, code: "unknown", message: "Sign in did not return a session." }
    }

    await setRefreshToken(refreshToken)

    return {
      ok: true,
      userId,
      email: data.user?.email ?? null,
      refreshToken,
      accessTokenExpiresAt: accessTokenExpiresAt(data.session.expires_at),
    }
  } catch (error) {
    if (isNetworkError(error)) {
      return { ok: false, code: "network", message: "Unable to reach the authentication service." }
    }
    return { ok: false, code: "unknown", message: "Sign in failed." }
  }
}

export type PasswordResetResult =
  | { ok: true }
  | { ok: false; code: AuthErrorCode | "invalid_code"; message: string }

/**
 * Emails a recovery code to the account. The Supabase "Reset Password" email
 * template must render {{ .Token }} so the user gets a code they can type
 * into the desktop app (the default template only contains a browser link).
 */
export async function requestPasswordReset(email: string): Promise<PasswordResetResult> {
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email)

    if (error) {
      if (isNetworkError(error)) {
        return { ok: false, code: "network", message: "Unable to reach the authentication service." }
      }
      return {
        ok: false,
        code: mapAuthError(error),
        message: error.message || "Could not send the reset code.",
      }
    }

    return { ok: true }
  } catch (error) {
    if (isNetworkError(error)) {
      return { ok: false, code: "network", message: "Unable to reach the authentication service." }
    }
    return { ok: false, code: "unknown", message: "Could not send the reset code." }
  }
}

/**
 * Verifies the emailed recovery code and sets the new password. The temporary
 * recovery session is discarded afterwards; the user signs in normally with
 * the new password (which also runs device registration).
 */
export async function resetPasswordWithCode(
  email: string,
  code: string,
  newPassword: string,
): Promise<PasswordResetResult> {
  try {
    const supabase = getSupabaseClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: "recovery",
      email,
      token: code,
    })

    if (verifyError) {
      if (isNetworkError(verifyError)) {
        return { ok: false, code: "network", message: "Unable to reach the authentication service." }
      }
      return {
        ok: false,
        code: "invalid_code",
        message: "The reset code is incorrect or has expired. Request a new one.",
      }
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

    if (updateError) {
      if (isNetworkError(updateError)) {
        return { ok: false, code: "network", message: "Unable to reach the authentication service." }
      }
      return {
        ok: false,
        code: "unknown",
        message: updateError.message || "Could not update the password.",
      }
    }

    return { ok: true }
  } catch (error) {
    if (isNetworkError(error)) {
      return { ok: false, code: "network", message: "Unable to reach the authentication service." }
    }
    return { ok: false, code: "unknown", message: "Could not update the password." }
  } finally {
    // Drop the temporary recovery session; it must never become a stored login.
    try {
      await getSupabaseClient().auth.signOut()
    } catch {
      // Ignored: the in-memory session dies with the client either way.
    }
  }
}

export async function signOut(): Promise<void> {
  try {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
  } catch {
    // Local session is cleared regardless of remote sign-out success.
  } finally {
    await clearToken()
  }
}

export async function restoreSession(): Promise<RestoreSessionResult> {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) {
    return { ok: false, code: "expired", message: "No stored session." }
  }

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })

    if (error) {
      if (isNetworkError(error)) {
        return { ok: false, code: "network", message: "Unable to reach the authentication service." }
      }
      return { ok: false, code: "expired", message: "Stored session is no longer valid." }
    }

    const rotatedToken = data.session?.refresh_token
    const userId = data.user?.id
    if (!rotatedToken || !userId) {
      return { ok: false, code: "expired", message: "Stored session is no longer valid." }
    }

    await setRefreshToken(rotatedToken)

    return {
      ok: true,
      userId,
      email: data.user?.email ?? null,
      refreshToken: rotatedToken,
      accessTokenExpiresAt: accessTokenExpiresAt(data.session?.expires_at),
    }
  } catch (error) {
    if (isNetworkError(error)) {
      return { ok: false, code: "network", message: "Unable to reach the authentication service." }
    }
    return { ok: false, code: "unknown", message: "Session restore failed." }
  }
}
