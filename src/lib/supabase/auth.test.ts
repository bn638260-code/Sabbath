import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetSupabaseClientForTests } from "@/lib/supabase/client"

const mockSignUp = vi.fn()
const mockSignInWithPassword = vi.fn()
const mockSignOut = vi.fn()
const mockRefreshSession = vi.fn()
const mockResetPasswordForEmail = vi.fn()
const mockVerifyOtp = vi.fn()
const mockUpdateUser = vi.fn()

vi.mock("@/lib/supabase/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/client")>()
  return {
    ...actual,
    getSupabaseClient: () => ({
      auth: {
        signUp: mockSignUp,
        signInWithPassword: mockSignInWithPassword,
        signOut: mockSignOut,
        refreshSession: mockRefreshSession,
        resetPasswordForEmail: mockResetPasswordForEmail,
        verifyOtp: mockVerifyOtp,
        updateUser: mockUpdateUser,
      },
    }),
  }
})

const mockGetRefreshToken = vi.fn()
const mockSetRefreshToken = vi.fn()
const mockClearToken = vi.fn()

vi.mock("@/lib/verification/session-storage", () => ({
  getRefreshToken: (...args: unknown[]) => mockGetRefreshToken(...args),
  setRefreshToken: (...args: unknown[]) => mockSetRefreshToken(...args),
  clearToken: (...args: unknown[]) => mockClearToken(...args),
}))

describe("supabase auth", () => {
  beforeEach(() => {
    resetSupabaseClientForTests()
    mockSignUp.mockReset()
    mockSignInWithPassword.mockReset()
    mockSignOut.mockReset()
    mockRefreshSession.mockReset()
    mockResetPasswordForEmail.mockReset()
    mockVerifyOtp.mockReset()
    mockUpdateUser.mockReset()
    mockGetRefreshToken.mockReset()
    mockSetRefreshToken.mockReset()
    mockClearToken.mockReset()
  })

  it("signInWithEmail stores the refresh token on success", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: "user-1" },
        session: { refresh_token: "refresh-a", expires_at: 1_700_000_000 },
      },
      error: null,
    })

    const { signInWithEmail } = await import("@/lib/supabase/auth")
    const result = await signInWithEmail("user@example.com", "secret")

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        userId: "user-1",
        refreshToken: "refresh-a",
      }),
    )
    expect(mockSetRefreshToken).toHaveBeenCalledWith("refresh-a")
  })

  it("signInWithEmail maps invalid credentials", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials", status: 400 },
    })

    const { signInWithEmail } = await import("@/lib/supabase/auth")
    const result = await signInWithEmail("user@example.com", "wrong")

    expect(result).toEqual({
      ok: false,
      code: "invalid_credentials",
      message: "Invalid login credentials",
    })
    expect(mockSetRefreshToken).not.toHaveBeenCalled()
  })

  it("signUpWithEmail stores the refresh token when sign-up returns a session", async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: "user-1" },
        session: { refresh_token: "signup-refresh", expires_at: 1_700_000_000 },
      },
      error: null,
    })

    const { signUpWithEmail } = await import("@/lib/supabase/auth")
    const result = await signUpWithEmail("user@example.com", "secret")

    expect(result).toEqual({
      ok: true,
      needsEmailConfirmation: false,
      userId: "user-1",
      email: null,
      refreshToken: "signup-refresh",
    })
    expect(mockSetRefreshToken).toHaveBeenCalledWith("signup-refresh")
  })

  it("signUpWithEmail returns needsEmailConfirmation when no session is returned", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: null },
      error: null,
    })

    const { signUpWithEmail } = await import("@/lib/supabase/auth")
    const result = await signUpWithEmail("user@example.com", "secret")

    expect(result).toEqual({ ok: true, needsEmailConfirmation: true })
    expect(mockSetRefreshToken).not.toHaveBeenCalled()
  })

  it("restoreSession persists the rotated refresh token before returning", async () => {
    mockGetRefreshToken.mockResolvedValue("old-refresh")
    mockRefreshSession.mockResolvedValue({
      data: {
        user: { id: "user-1" },
        session: { refresh_token: "new-refresh", expires_at: 1_700_000_000 },
      },
      error: null,
    })

    let persistedBeforeResolve = false
    mockSetRefreshToken.mockImplementation(async () => {
      persistedBeforeResolve = true
    })

    const { restoreSession } = await import("@/lib/supabase/auth")
    const result = await restoreSession()

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        userId: "user-1",
        refreshToken: "new-refresh",
      }),
    )
    expect(mockSetRefreshToken).toHaveBeenCalledWith("new-refresh")
    expect(persistedBeforeResolve).toBe(true)
  })

  it("restoreSession returns expired when no stored refresh token exists", async () => {
    mockGetRefreshToken.mockResolvedValue(null)

    const { restoreSession } = await import("@/lib/supabase/auth")
    const result = await restoreSession()

    expect(result).toEqual({
      ok: false,
      code: "expired",
      message: "No stored session.",
    })
    expect(mockRefreshSession).not.toHaveBeenCalled()
  })

  it("signInWithEmail returns network when the auth service is unreachable", async () => {
    mockSignInWithPassword.mockRejectedValue(new TypeError("Failed to fetch"))

    const { signInWithEmail } = await import("@/lib/supabase/auth")
    const result = await signInWithEmail("user@example.com", "secret")

    expect(result).toEqual({
      ok: false,
      code: "network",
      message: "Unable to reach the authentication service.",
    })
    expect(mockSetRefreshToken).not.toHaveBeenCalled()
  })

  it("restoreSession returns network when refresh fails due to connectivity", async () => {
    mockGetRefreshToken.mockResolvedValue("stored-refresh")
    mockRefreshSession.mockRejectedValue(new TypeError("NetworkError when attempting to fetch resource."))

    const { restoreSession } = await import("@/lib/supabase/auth")
    const result = await restoreSession()

    expect(result).toEqual({
      ok: false,
      code: "network",
      message: "Unable to reach the authentication service.",
    })
    expect(mockSetRefreshToken).not.toHaveBeenCalled()
  })

  it("restoreSession returns expired when refresh is rejected", async () => {
    mockGetRefreshToken.mockResolvedValue("stale-refresh")
    mockRefreshSession.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid Refresh Token", status: 401 },
    })

    const { restoreSession } = await import("@/lib/supabase/auth")
    const result = await restoreSession()

    expect(result).toEqual({
      ok: false,
      code: "expired",
      message: "Stored session is no longer valid.",
    })
  })

  it("requestPasswordReset succeeds when the email is accepted", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null })

    const { requestPasswordReset } = await import("@/lib/supabase/auth")
    const result = await requestPasswordReset("user@example.com")

    expect(result).toEqual({ ok: true })
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith("user@example.com")
  })

  it("requestPasswordReset returns network when the service is unreachable", async () => {
    mockResetPasswordForEmail.mockRejectedValue(new TypeError("Failed to fetch"))

    const { requestPasswordReset } = await import("@/lib/supabase/auth")
    const result = await requestPasswordReset("user@example.com")

    expect(result).toEqual({
      ok: false,
      code: "network",
      message: "Unable to reach the authentication service.",
    })
  })

  it("resetPasswordWithCode updates the password and discards the recovery session", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: { refresh_token: "recovery" } },
      error: null,
    })
    mockUpdateUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
    mockSignOut.mockResolvedValue({ error: null })

    const { resetPasswordWithCode } = await import("@/lib/supabase/auth")
    const result = await resetPasswordWithCode("user@example.com", "123456", "new-secret")

    expect(result).toEqual({ ok: true })
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      email: "user@example.com",
      token: "123456",
    })
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: "new-secret" })
    expect(mockSignOut).toHaveBeenCalled()
    expect(mockSetRefreshToken).not.toHaveBeenCalled()
  })

  it("resetPasswordWithCode maps a rejected code to invalid_code", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Token has expired or is invalid", status: 403 },
    })
    mockSignOut.mockResolvedValue({ error: null })

    const { resetPasswordWithCode } = await import("@/lib/supabase/auth")
    const result = await resetPasswordWithCode("user@example.com", "000000", "new-secret")

    expect(result).toEqual({
      ok: false,
      code: "invalid_code",
      message: "The reset code is incorrect or has expired. Request a new one.",
    })
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it("resetPasswordWithCode surfaces password policy errors from updateUser", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: { refresh_token: "recovery" } },
      error: null,
    })
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Password should be at least 6 characters.", status: 422 },
    })
    mockSignOut.mockResolvedValue({ error: null })

    const { resetPasswordWithCode } = await import("@/lib/supabase/auth")
    const result = await resetPasswordWithCode("user@example.com", "123456", "x")

    expect(result).toEqual({
      ok: false,
      code: "unknown",
      message: "Password should be at least 6 characters.",
    })
    expect(mockSignOut).toHaveBeenCalled()
  })

  it("signOut clears the local refresh token", async () => {
    mockSignOut.mockResolvedValue({ error: null })

    const { signOut } = await import("@/lib/supabase/auth")
    await signOut()

    expect(mockSignOut).toHaveBeenCalled()
    expect(mockClearToken).toHaveBeenCalled()
  })
})
