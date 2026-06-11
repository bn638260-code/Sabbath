import { beforeEach, describe, expect, it, vi } from "vitest"

const mockRestoreSession = vi.fn()
const mockSignInWithEmail = vi.fn()
const mockSignUpWithEmail = vi.fn()
const mockSupabaseSignOut = vi.fn()
const mockRegisterDevice = vi.fn()
const mockGetOrCreateDeviceId = vi.fn()
const mockGetRefreshToken = vi.fn()
const mockSetSessionMetadata = vi.fn()
const mockClearSessionMetadata = vi.fn()

vi.mock("@/lib/supabase/auth", () => ({
  restoreSession: (...args: unknown[]) => mockRestoreSession(...args),
  signInWithEmail: (...args: unknown[]) => mockSignInWithEmail(...args),
  signUpWithEmail: (...args: unknown[]) => mockSignUpWithEmail(...args),
  signOut: (...args: unknown[]) => mockSupabaseSignOut(...args),
}))

vi.mock("@/lib/supabase/devices", () => ({
  registerDevice: (...args: unknown[]) => mockRegisterDevice(...args),
}))

vi.mock("@/lib/verification/device-id", () => ({
  getOrCreateDeviceId: (...args: unknown[]) => mockGetOrCreateDeviceId(...args),
}))

vi.mock("@/lib/verification/session-storage", () => ({
  getRefreshToken: (...args: unknown[]) => mockGetRefreshToken(...args),
  setSessionMetadata: (...args: unknown[]) => mockSetSessionMetadata(...args),
  clearSessionMetadata: (...args: unknown[]) => mockClearSessionMetadata(...args),
}))

describe("verification-provider", () => {
  beforeEach(() => {
    vi.resetModules()
    mockRestoreSession.mockReset()
    mockSignInWithEmail.mockReset()
    mockSignUpWithEmail.mockReset()
    mockSupabaseSignOut.mockReset()
    mockRegisterDevice.mockReset()
    mockGetOrCreateDeviceId.mockReset()
    mockGetRefreshToken.mockReset()
    mockSetSessionMetadata.mockReset()
    mockClearSessionMetadata.mockReset()

    mockGetOrCreateDeviceId.mockResolvedValue("device-1")
    mockRegisterDevice.mockResolvedValue({ ok: true })
  })

  it("loadCachedVerification returns required when no keychain token exists", async () => {
    mockGetRefreshToken.mockResolvedValue(null)

    const { loadCachedVerification } = await import("@/lib/verification/verification-provider")
    const result = await loadCachedVerification()

    expect(result.status).toBe("required")
    expect(mockRestoreSession).not.toHaveBeenCalled()
  })

  it("loadCachedVerification returns expired when refresh is rejected", async () => {
    mockGetRefreshToken.mockResolvedValue("stale-token")
    mockRestoreSession.mockResolvedValue({
      ok: false,
      code: "expired",
      message: "Stored session is no longer valid.",
    })

    const { loadCachedVerification } = await import("@/lib/verification/verification-provider")
    const result = await loadCachedVerification()

    expect(result.status).toBe("expired")
    expect(mockRegisterDevice).not.toHaveBeenCalled()
  })

  it("loadCachedVerification returns error(network) when restore fails due to connectivity", async () => {
    mockGetRefreshToken.mockResolvedValue("stored-token")
    mockRestoreSession.mockResolvedValue({
      ok: false,
      code: "network",
      message: "Unable to reach the authentication service.",
    })

    const { loadCachedVerification } = await import("@/lib/verification/verification-provider")
    const result = await loadCachedVerification()

    expect(result).toEqual(
      expect.objectContaining({
        status: "error",
        errorCode: "network",
      }),
    )
  })

  it("loadCachedVerification returns error(device_limit_reached) when registration is blocked", async () => {
    mockGetRefreshToken.mockResolvedValue("stored-token")
    mockRestoreSession.mockResolvedValue({
      ok: true,
      userId: "user-1",
      refreshToken: "rotated-token",
      accessTokenExpiresAt: 1_700_000_000_000,
    })
    mockRegisterDevice.mockResolvedValue({ ok: false, code: "device_limit_reached" })

    const { loadCachedVerification } = await import("@/lib/verification/verification-provider")
    const result = await loadCachedVerification()

    expect(result).toEqual(
      expect.objectContaining({
        status: "error",
        errorCode: "device_limit_reached",
      }),
    )
    expect(mockSetSessionMetadata).not.toHaveBeenCalled()
  })

  it("loadCachedVerification returns verified and persists metadata on success", async () => {
    mockGetRefreshToken.mockResolvedValue("stored-token")
    mockRestoreSession.mockResolvedValue({
      ok: true,
      userId: "user-1",
      refreshToken: "rotated-token",
      accessTokenExpiresAt: 1_700_000_000_000,
    })

    const { loadCachedVerification } = await import("@/lib/verification/verification-provider")
    const result = await loadCachedVerification()

    expect(result).toEqual(
      expect.objectContaining({
        status: "verified",
        verifiedUserId: "user-1",
        verifiedDeviceId: "device-1",
        error: null,
        errorCode: null,
      }),
    )
    expect(mockSetSessionMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        verifiedUserId: "user-1",
        verifiedDeviceId: "device-1",
      }),
    )
  })

  it("signIn returns verified after auth and device registration succeed", async () => {
    mockSignInWithEmail.mockResolvedValue({
      ok: true,
      userId: "user-2",
      refreshToken: "refresh-b",
      accessTokenExpiresAt: 1_700_000_000_000,
    })

    const { signIn } = await import("@/lib/verification/verification-provider")
    const result = await signIn("user@example.com", "secret")

    expect(result.status).toBe("verified")
    expect(mockSignInWithEmail).toHaveBeenCalledWith("user@example.com", "secret")
    expect(mockRegisterDevice).toHaveBeenCalled()
  })

  it("signUp returns error when email confirmation is required", async () => {
    mockSignUpWithEmail.mockResolvedValue({ ok: true, needsEmailConfirmation: true })

    const { signUp } = await import("@/lib/verification/verification-provider")
    const result = await signUp("user@example.com", "secret")

    expect(result).toEqual(
      expect.objectContaining({
        status: "error",
        error: expect.stringContaining("Check your email"),
      }),
    )
    expect(mockRegisterDevice).not.toHaveBeenCalled()
  })

  it("heartbeat returns a suspended snapshot and clears metadata when blocked", async () => {
    mockRegisterDevice.mockResolvedValue({ ok: false, code: "suspended" })

    const { heartbeatDeviceRegistration } = await import(
      "@/lib/verification/verification-provider"
    )
    const result = await heartbeatDeviceRegistration()

    expect(result).toEqual(
      expect.objectContaining({ status: "error", errorCode: "suspended" }),
    )
    expect(mockClearSessionMetadata).toHaveBeenCalled()
  })

  it("heartbeat returns null on transient registration failure", async () => {
    mockRegisterDevice.mockResolvedValue({
      ok: false,
      code: "error",
      message: "Unable to reach the device registration service.",
    })

    const { heartbeatDeviceRegistration } = await import(
      "@/lib/verification/verification-provider"
    )
    const result = await heartbeatDeviceRegistration()

    expect(result).toBeNull()
    expect(mockClearSessionMetadata).not.toHaveBeenCalled()
  })

  it("signOut clears local session metadata", async () => {
    mockSupabaseSignOut.mockResolvedValue(undefined)

    const { signOut } = await import("@/lib/verification/verification-provider")
    const result = await signOut()

    expect(mockSupabaseSignOut).toHaveBeenCalled()
    expect(mockClearSessionMetadata).toHaveBeenCalled()
    expect(result.status).toBe("required")
  })
})
