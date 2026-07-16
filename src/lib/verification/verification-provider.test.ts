import { beforeEach, describe, expect, it, vi } from "vitest"

const mockRestoreSession = vi.fn()
const mockSignInWithEmail = vi.fn()
const mockSignUpWithEmail = vi.fn()
const mockSupabaseSignOut = vi.fn()
const mockRegisterDevice = vi.fn()
const mockGetOrCreateInstallationIdentity = vi.fn()
const mockGetRefreshToken = vi.fn()
const mockGetSessionMetadata = vi.fn()
const mockSetSessionMetadata = vi.fn()
const mockClearSessionMetadata = vi.fn()
const mockClearToken = vi.fn()
const mockVerifyActivationLease = vi.fn()
const signedLease = { payload: "lease-payload", signature: "lease-signature" }

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
  getOrCreateInstallationIdentity: (...args: unknown[]) =>
    mockGetOrCreateInstallationIdentity(...args),
}))

vi.mock("@/lib/verification/activation-lease", () => ({
  verifyActivationLease: (...args: unknown[]) =>
    mockVerifyActivationLease(...args),
}))

vi.mock("@/lib/verification/session-storage", () => ({
  clearToken: (...args: unknown[]) => mockClearToken(...args),
  getRefreshToken: (...args: unknown[]) => mockGetRefreshToken(...args),
  getSessionMetadata: (...args: unknown[]) => mockGetSessionMetadata(...args),
  setSessionMetadata: (...args: unknown[]) => mockSetSessionMetadata(...args),
  clearSessionMetadata: (...args: unknown[]) =>
    mockClearSessionMetadata(...args),
}))

describe("verification-provider", () => {
  beforeEach(() => {
    vi.resetModules()
    mockRestoreSession.mockReset()
    mockSignInWithEmail.mockReset()
    mockSignUpWithEmail.mockReset()
    mockSupabaseSignOut.mockReset()
    mockRegisterDevice.mockReset()
    mockGetOrCreateInstallationIdentity.mockReset()
    mockGetRefreshToken.mockReset()
    mockGetSessionMetadata.mockReset()
    mockSetSessionMetadata.mockReset()
    mockClearSessionMetadata.mockReset()
    mockClearToken.mockReset()
    mockVerifyActivationLease.mockReset()

    mockGetOrCreateInstallationIdentity.mockResolvedValue({
      deviceId: "device-1",
      publicKey: "public-key",
    })
    mockRegisterDevice.mockResolvedValue({
      ok: true,
      accessExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      isChurchOrganization: false,
      churchName: null,
      lease: signedLease,
    })
    mockGetSessionMetadata.mockResolvedValue({
      verifiedUserId: "user-1",
      verifiedDeviceId: "device-1",
      accessTokenExpiresAt: Date.now() + 3_600_000,
      lastVerifiedAt: Date.now() - 60_000,
      offlineGraceExpiresAt: Date.now() + 60_000,
      accessExpiresAt: Date.now() + 60_000,
      activationLease: signedLease,
    })
    mockVerifyActivationLease.mockResolvedValue({
      expiresAt: Date.now() + 60_000,
    })
  })

  it("loadCachedVerification returns required when no keychain token exists", async () => {
    mockGetRefreshToken.mockResolvedValue(null)

    const { loadCachedVerification } =
      await import("@/lib/verification/verification-provider")
    const result = await loadCachedVerification()

    expect(result.status).toBe("required")
    expect(mockRestoreSession).not.toHaveBeenCalled()
  })

  it("loadCachedVerification clears an expired session and returns sign-in required", async () => {
    mockGetRefreshToken.mockResolvedValue("stale-token")
    mockRestoreSession.mockResolvedValue({
      ok: false,
      code: "expired",
      message: "Stored session is no longer valid.",
    })

    const { loadCachedVerification } =
      await import("@/lib/verification/verification-provider")
    const result = await loadCachedVerification()

    expect(result.status).toBe("required")
    expect(mockClearToken).toHaveBeenCalledTimes(1)
    expect(mockClearSessionMetadata).toHaveBeenCalledTimes(1)
    expect(mockRegisterDevice).not.toHaveBeenCalled()
  })

  it("loadCachedVerification returns error(network) when restore fails offline with no cached session", async () => {
    mockGetSessionMetadata.mockResolvedValue(null)
    mockGetRefreshToken.mockResolvedValue("stored-token")
    mockRestoreSession.mockResolvedValue({
      ok: false,
      code: "network",
      message: "Unable to reach the authentication service.",
    })

    const { loadCachedVerification } =
      await import("@/lib/verification/verification-provider")
    const result = await loadCachedVerification()

    expect(result).toEqual(
      expect.objectContaining({
        status: "error",
        errorCode: "network",
      })
    )
  })

  it("loadCachedVerification grants offline grace when restore fails offline within the window", async () => {
    mockGetRefreshToken.mockResolvedValue("stored-token")
    mockRestoreSession.mockResolvedValue({
      ok: false,
      code: "network",
      message: "Unable to reach the authentication service.",
    })
    mockGetSessionMetadata.mockResolvedValue({
      verifiedUserId: "user-1",
      verifiedDeviceId: "device-1",
      accessTokenExpiresAt: Date.now() - 1000,
      lastVerifiedAt: Date.now() - 60_000,
      offlineGraceExpiresAt: Date.now() + 60_000,
      accessExpiresAt: Date.now() + 60_000,
      activationLease: signedLease,
    })

    const { loadCachedVerification } =
      await import("@/lib/verification/verification-provider")
    const result = await loadCachedVerification()

    expect(result).toEqual(
      expect.objectContaining({
        status: "verified",
        verifiedUserId: "user-1",
        verifiedDeviceId: "device-1",
      })
    )
  })

  it("loadCachedVerification rejects legacy offline metadata without a signed lease", async () => {
    mockGetRefreshToken.mockResolvedValue("stored-token")
    mockRestoreSession.mockResolvedValue({
      ok: false,
      code: "network",
      message: "Unable to reach the authentication service.",
    })
    mockGetSessionMetadata.mockResolvedValue({
      verifiedUserId: "user-1",
      verifiedDeviceId: "device-1",
      accessTokenExpiresAt: Date.now() - 1000,
      lastVerifiedAt: Date.now() - 24 * 60 * 60 * 1000,
      offlineGraceExpiresAt: 0,
      accessExpiresAt: Date.now() + 60_000,
    })

    const { loadCachedVerification } =
      await import("@/lib/verification/verification-provider")
    const result = await loadCachedVerification()

    expect(result).toEqual(
      expect.objectContaining({ status: "error", errorCode: "network" })
    )
  })

  it("loadCachedVerification denies offline grace once the window has expired", async () => {
    mockVerifyActivationLease.mockResolvedValue(null)
    mockGetRefreshToken.mockResolvedValue("stored-token")
    mockRestoreSession.mockResolvedValue({
      ok: false,
      code: "network",
      message: "Unable to reach the authentication service.",
    })
    mockGetSessionMetadata.mockResolvedValue({
      verifiedUserId: "user-1",
      verifiedDeviceId: "device-1",
      accessTokenExpiresAt: Date.now() - 1000,
      lastVerifiedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
      offlineGraceExpiresAt: Date.now() - 60_000,
      accessExpiresAt: Date.now() + 60_000,
      activationLease: signedLease,
    })

    const { loadCachedVerification } =
      await import("@/lib/verification/verification-provider")
    const result = await loadCachedVerification()

    expect(result).toEqual(
      expect.objectContaining({ status: "error", errorCode: "network" })
    )
  })

  it("loadCachedVerification denies offline grace once account access has expired", async () => {
    mockVerifyActivationLease.mockResolvedValue(null)
    mockGetRefreshToken.mockResolvedValue("stored-token")
    mockRestoreSession.mockResolvedValue({
      ok: false,
      code: "network",
      message: "Unable to reach the authentication service.",
    })
    mockGetSessionMetadata.mockResolvedValue({
      verifiedUserId: "user-1",
      verifiedDeviceId: "device-1",
      accessTokenExpiresAt: Date.now() - 1000,
      lastVerifiedAt: Date.now() - 60_000,
      offlineGraceExpiresAt: Date.now() + 60_000,
      accessExpiresAt: Date.now() - 1000,
      activationLease: signedLease,
    })

    const { loadCachedVerification } =
      await import("@/lib/verification/verification-provider")
    const result = await loadCachedVerification()

    expect(result).toEqual(
      expect.objectContaining({ status: "error", errorCode: "network" })
    )
  })

  it("loadCachedVerification grants offline grace when device registration fails offline", async () => {
    mockGetRefreshToken.mockResolvedValue("stored-token")
    mockRestoreSession.mockResolvedValue({
      ok: true,
      userId: "user-1",
      refreshToken: "rotated-token",
      accessTokenExpiresAt: 1_700_000_000_000,
    })
    mockRegisterDevice.mockResolvedValue({
      ok: false,
      code: "error",
      message: "Unable to reach the device registration service.",
    })
    mockGetSessionMetadata.mockResolvedValue({
      verifiedUserId: "user-1",
      verifiedDeviceId: "device-1",
      accessTokenExpiresAt: Date.now() - 1000,
      lastVerifiedAt: Date.now() - 60_000,
      offlineGraceExpiresAt: Date.now() + 60_000,
      accessExpiresAt: Date.now() + 60_000,
      activationLease: signedLease,
    })

    const { loadCachedVerification } =
      await import("@/lib/verification/verification-provider")
    const result = await loadCachedVerification()

    expect(result.status).toBe("verified")
  })

  it("loadCachedVerification returns error(device_limit_reached) when registration is blocked", async () => {
    mockGetRefreshToken.mockResolvedValue("stored-token")
    mockRestoreSession.mockResolvedValue({
      ok: true,
      userId: "user-1",
      refreshToken: "rotated-token",
      accessTokenExpiresAt: 1_700_000_000_000,
    })
    mockRegisterDevice.mockResolvedValue({
      ok: false,
      code: "device_limit_reached",
    })

    const { loadCachedVerification } =
      await import("@/lib/verification/verification-provider")
    const result = await loadCachedVerification()

    expect(result).toEqual(
      expect.objectContaining({
        status: "error",
        errorCode: "device_limit_reached",
      })
    )
    expect(mockSetSessionMetadata).not.toHaveBeenCalled()
  })

  it("loadCachedVerification returns error(trial_expired) when access has ended", async () => {
    mockGetRefreshToken.mockResolvedValue("stored-token")
    mockRestoreSession.mockResolvedValue({
      ok: true,
      userId: "user-1",
      refreshToken: "rotated-token",
      accessTokenExpiresAt: 1_700_000_000_000,
    })
    mockRegisterDevice.mockResolvedValue({
      ok: false,
      code: "trial_expired",
    })

    const { loadCachedVerification } =
      await import("@/lib/verification/verification-provider")
    const result = await loadCachedVerification()

    expect(result).toEqual(
      expect.objectContaining({
        status: "error",
        errorCode: "trial_expired",
        error: "Your access has ended. Contact the developer to renew.",
      })
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

    const { loadCachedVerification } =
      await import("@/lib/verification/verification-provider")
    const result = await loadCachedVerification()

    expect(result).toEqual(
      expect.objectContaining({
        status: "verified",
        verifiedUserId: "user-1",
        verifiedDeviceId: "device-1",
        error: null,
        errorCode: null,
      })
    )
    expect(mockSetSessionMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        verifiedUserId: "user-1",
        verifiedDeviceId: "device-1",
        accessExpiresAt: expect.any(Number),
      })
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
    expect(mockSignInWithEmail).toHaveBeenCalledWith(
      "user@example.com",
      "secret"
    )
    expect(mockRegisterDevice).toHaveBeenCalled()
  })

  it("signUp returns required with a notice when email confirmation is required", async () => {
    mockSignUpWithEmail.mockResolvedValue({
      ok: true,
      needsEmailConfirmation: true,
    })

    const { signUp } = await import("@/lib/verification/verification-provider")
    const profile = {
      isChurchOrganization: true,
      churchName: "Central SDA Church",
      lease: signedLease,
    }
    const result = await signUp("user@example.com", "secret", profile)

    expect(result).toEqual(
      expect.objectContaining({
        status: "required",
        error: expect.stringContaining("Check your email"),
        errorCode: null,
      })
    )
    expect(mockSignUpWithEmail).toHaveBeenCalledWith(
      "user@example.com",
      "secret",
      profile
    )
    expect(mockRegisterDevice).not.toHaveBeenCalled()
  })

  it("signUp verifies the immediate auth session without restoring it", async () => {
    mockRegisterDevice.mockResolvedValue({
      ok: true,
      accessExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      isChurchOrganization: true,
      churchName: "Central SDA Church",
    })
    mockSignUpWithEmail.mockResolvedValue({
      ok: true,
      needsEmailConfirmation: false,
      userId: "user-3",
      email: "user@example.com",
      refreshToken: "signup-refresh",
      accessTokenExpiresAt: 1_700_000_000_000,
    })

    const { signUp } = await import("@/lib/verification/verification-provider")
    const result = await signUp("user@example.com", "secret", {
      isChurchOrganization: true,
      churchName: "Central SDA Church",
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: "verified",
        verifiedUserId: "user-3",
        verifiedDeviceId: "device-1",
        verifiedEmail: "user@example.com",
        isChurchOrganization: true,
        churchName: "Central SDA Church",
      })
    )
    expect(mockRestoreSession).not.toHaveBeenCalled()
    expect(mockRegisterDevice).toHaveBeenCalled()
  })

  it("heartbeat returns a suspended snapshot and clears metadata when blocked", async () => {
    mockRegisterDevice.mockResolvedValue({ ok: false, code: "suspended" })

    const { heartbeatDeviceRegistration } =
      await import("@/lib/verification/verification-provider")
    const result = await heartbeatDeviceRegistration()

    expect(result).toEqual(
      expect.objectContaining({ status: "error", errorCode: "suspended" })
    )
    expect(mockClearSessionMetadata).toHaveBeenCalled()
  })

  it("heartbeat returns a trial_expired snapshot and clears metadata when access ends", async () => {
    mockRegisterDevice.mockResolvedValue({ ok: false, code: "trial_expired" })

    const { heartbeatDeviceRegistration } =
      await import("@/lib/verification/verification-provider")
    const result = await heartbeatDeviceRegistration()

    expect(result).toEqual(
      expect.objectContaining({ status: "error", errorCode: "trial_expired" })
    )
    expect(mockClearSessionMetadata).toHaveBeenCalled()
  })

  it("heartbeat blocks an active session when the device limit is returned", async () => {
    mockRegisterDevice.mockResolvedValue({
      ok: false,
      code: "device_limit_reached",
    })

    const { heartbeatDeviceRegistration } =
      await import("@/lib/verification/verification-provider")
    const result = await heartbeatDeviceRegistration()

    expect(result).toEqual(
      expect.objectContaining({
        status: "error",
        errorCode: "device_limit_reached",
      })
    )
    expect(mockClearSessionMetadata).toHaveBeenCalled()
  })

  it.each(["device_pending", "device_revoked"] as const)(
    "heartbeat blocks an active session when the server returns %s",
    async (errorCode) => {
      mockRegisterDevice.mockResolvedValue({ ok: false, code: errorCode })

      const { heartbeatDeviceRegistration } =
        await import("@/lib/verification/verification-provider")
      const result = await heartbeatDeviceRegistration()

      expect(result).toEqual(
        expect.objectContaining({ status: "error", errorCode })
      )
      expect(mockClearSessionMetadata).toHaveBeenCalled()
    }
  )

  it("heartbeat refreshes cached access expiry on success", async () => {
    const nextAccessExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000
    mockRegisterDevice.mockResolvedValue({
      ok: true,
      accessExpiresAt: nextAccessExpiresAt,
      isChurchOrganization: false,
      churchName: null,
      lease: signedLease,
    })
    mockGetSessionMetadata.mockResolvedValue({
      verifiedUserId: "user-1",
      verifiedDeviceId: "device-1",
      accessTokenExpiresAt: Date.now() + 3_600_000,
      lastVerifiedAt: Date.now() - 60_000,
      offlineGraceExpiresAt: Date.now() + 60_000,
      accessExpiresAt: Date.now() + 60_000,
      verifiedEmail: "user@example.com",
      activationLease: signedLease,
    })

    const { heartbeatDeviceRegistration } =
      await import("@/lib/verification/verification-provider")
    const result = await heartbeatDeviceRegistration()

    expect(result).toBeNull()
    expect(mockSetSessionMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        accessExpiresAt: nextAccessExpiresAt,
        verifiedEmail: "user@example.com",
      })
    )
  })

  it("heartbeat returns null on transient registration failure", async () => {
    mockRegisterDevice.mockResolvedValue({
      ok: false,
      code: "error",
      message: "Unable to reach the device registration service.",
    })

    const { heartbeatDeviceRegistration } =
      await import("@/lib/verification/verification-provider")
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

  it("heartbeat refreshes a stale access token before re-registering", async () => {
    mockGetSessionMetadata.mockResolvedValue({
      verifiedUserId: "user-1",
      verifiedDeviceId: "device-1",
      accessTokenExpiresAt: Date.now() - 1000,
      lastVerifiedAt: Date.now() - 60_000,
      offlineGraceExpiresAt: Date.now() + 1_000_000,
      accessExpiresAt: Date.now() + 1_000_000,
      verifiedEmail: "a@b.c",
    })
    mockRestoreSession.mockResolvedValue({
      ok: true,
      userId: "user-1",
      email: "a@b.c",
      refreshToken: "rotated",
      accessTokenExpiresAt: Date.now() + 3_600_000,
    })

    const { heartbeatDeviceRegistration } =
      await import("@/lib/verification/verification-provider")
    const result = await heartbeatDeviceRegistration()

    expect(mockRestoreSession).toHaveBeenCalledTimes(1)
    expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
    expect(result).toBeNull()
  })

  it("heartbeat clears an expired session and requires sign-in", async () => {
    mockGetSessionMetadata.mockResolvedValue({
      verifiedUserId: "user-1",
      verifiedDeviceId: "device-1",
      accessTokenExpiresAt: Date.now() - 1000,
      lastVerifiedAt: Date.now() - 60_000,
      offlineGraceExpiresAt: Date.now() + 1_000_000,
      accessExpiresAt: Date.now() + 1_000_000,
      verifiedEmail: "a@b.c",
    })
    mockRestoreSession.mockResolvedValue({
      ok: false,
      code: "expired",
      message: "Stored session is no longer valid.",
    })

    const { heartbeatDeviceRegistration } =
      await import("@/lib/verification/verification-provider")
    const result = await heartbeatDeviceRegistration()

    expect(result?.status).toBe("required")
    expect(mockClearToken).toHaveBeenCalledTimes(1)
    expect(mockClearSessionMetadata).toHaveBeenCalledTimes(1)
    expect(mockRegisterDevice).not.toHaveBeenCalled()
  })

  it("heartbeat stays active (null) when the refresh fails on network", async () => {
    mockGetSessionMetadata.mockResolvedValue({
      verifiedUserId: "user-1",
      verifiedDeviceId: "device-1",
      accessTokenExpiresAt: Date.now() - 1000,
      lastVerifiedAt: Date.now() - 60_000,
      offlineGraceExpiresAt: Date.now() + 1_000_000,
      accessExpiresAt: Date.now() + 1_000_000,
      verifiedEmail: "a@b.c",
    })
    mockRestoreSession.mockResolvedValue({
      ok: false,
      code: "network",
      message: "Unable to reach the authentication service.",
    })

    const { heartbeatDeviceRegistration } =
      await import("@/lib/verification/verification-provider")
    const result = await heartbeatDeviceRegistration()

    expect(result).toBeNull()
    expect(mockClearSessionMetadata).not.toHaveBeenCalled()
    expect(mockRegisterDevice).not.toHaveBeenCalled()
  })
})
