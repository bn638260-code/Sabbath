import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockLoadCachedVerification = vi.fn()
const mockSignIn = vi.fn()
const mockSignUp = vi.fn()
const mockSignOut = vi.fn()
const mockRefreshVerification = vi.fn()
const mockClearVerification = vi.fn()
const mockHeartbeatDeviceRegistration = vi.fn()

vi.mock("@/lib/verification/verification-provider", () => ({
  loadCachedVerification: (...args: unknown[]) => mockLoadCachedVerification(...args),
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signUp: (...args: unknown[]) => mockSignUp(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  refreshVerification: (...args: unknown[]) => mockRefreshVerification(...args),
  clearVerification: (...args: unknown[]) => mockClearVerification(...args),
  heartbeatDeviceRegistration: (...args: unknown[]) => mockHeartbeatDeviceRegistration(...args),
}))

describe("verification-store", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    mockLoadCachedVerification.mockReset()
    mockSignIn.mockReset()
    mockSignUp.mockReset()
    mockSignOut.mockReset()
    mockRefreshVerification.mockReset()
    mockClearVerification.mockReset()
    mockHeartbeatDeviceRegistration.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("hydrate fails closed when no session can be restored", async () => {
    mockLoadCachedVerification.mockResolvedValue({
      status: "required",
      verifiedUserId: null,
      verifiedDeviceId: null,
      accessTokenExpiresAt: null,
      lastVerifiedAt: null,
      offlineGraceExpiresAt: null,
      error: null,
      errorCode: null,
    })

    const { hydrateVerification, useVerificationStore, isAppVerified } = await import(
      "./verification-store"
    )

    await hydrateVerification()

    expect(useVerificationStore.getState().status).toBe("required")
    expect(isAppVerified()).toBe(false)
  })

  it("signIn applies a verified snapshot and starts a single heartbeat interval", async () => {
    mockSignIn.mockResolvedValue({
      status: "verified",
      verifiedUserId: "user-1",
      verifiedDeviceId: "device-1",
      accessTokenExpiresAt: Date.now() + 60_000,
      lastVerifiedAt: Date.now(),
      offlineGraceExpiresAt: 0,
      error: null,
      errorCode: null,
    })

    const { useVerificationStore, isAppVerified } = await import("./verification-store")

    await useVerificationStore.getState().signIn("user@example.com", "secret")

    expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "secret")
    expect(useVerificationStore.getState().status).toBe("verified")
    expect(isAppVerified()).toBe(true)

    await vi.advanceTimersByTimeAsync(60 * 1000)
    expect(mockHeartbeatDeviceRegistration).toHaveBeenCalledTimes(1)

    mockSignOut.mockResolvedValue({
      status: "required",
      verifiedUserId: null,
      verifiedDeviceId: null,
      accessTokenExpiresAt: null,
      lastVerifiedAt: null,
      offlineGraceExpiresAt: null,
      error: null,
      errorCode: null,
    })
    await useVerificationStore.getState().signOut()
    mockHeartbeatDeviceRegistration.mockClear()
    await vi.advanceTimersByTimeAsync(60 * 1000)
    expect(mockHeartbeatDeviceRegistration).not.toHaveBeenCalled()
  })

  it("focus rechecks suspension and applies the blocking snapshot", async () => {
    const focusTarget = new EventTarget()
    vi.stubGlobal("window", {
      addEventListener: (type: string, listener: EventListener) =>
        focusTarget.addEventListener(type, listener),
      removeEventListener: (type: string, listener: EventListener) =>
        focusTarget.removeEventListener(type, listener),
    })
    vi.stubGlobal("document", {
      visibilityState: "visible",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    mockSignIn.mockResolvedValue({
      status: "verified",
      verifiedUserId: "user-1",
      verifiedDeviceId: "device-1",
      accessTokenExpiresAt: Date.now() + 60_000,
      lastVerifiedAt: Date.now(),
      offlineGraceExpiresAt: 0,
      error: null,
      errorCode: null,
    })
    mockHeartbeatDeviceRegistration.mockResolvedValue({
      status: "error",
      verifiedUserId: null,
      verifiedDeviceId: null,
      accessTokenExpiresAt: null,
      lastVerifiedAt: null,
      offlineGraceExpiresAt: null,
      error: "This account has been suspended. Contact support for assistance.",
      errorCode: "suspended",
    })

    const { useVerificationStore, isAppVerified } = await import(
      "./verification-store"
    )

    await useVerificationStore.getState().signIn("user@example.com", "secret")
    mockHeartbeatDeviceRegistration.mockClear()

    focusTarget.dispatchEvent(new Event("focus"))
    await Promise.resolve()
    await Promise.resolve()

    expect(mockHeartbeatDeviceRegistration).toHaveBeenCalledTimes(1)
    expect(useVerificationStore.getState().status).toBe("error")
    expect(useVerificationStore.getState().errorCode).toBe("suspended")
    expect(isAppVerified()).toBe(false)
  })

  it("signIn surfaces provider errors", async () => {
    mockSignIn.mockResolvedValue({
      status: "error",
      verifiedUserId: null,
      verifiedDeviceId: null,
      accessTokenExpiresAt: null,
      lastVerifiedAt: null,
      offlineGraceExpiresAt: null,
      error: "Invalid login credentials",
      errorCode: "invalid_credentials",
    })

    const { useVerificationStore, isAppVerified } = await import("./verification-store")

    await useVerificationStore.getState().signIn("user@example.com", "wrong")

    expect(useVerificationStore.getState().status).toBe("error")
    expect(useVerificationStore.getState().errorCode).toBe("invalid_credentials")
    expect(isAppVerified()).toBe(false)
  })

  it("signOut clears verified state", async () => {
    mockSignOut.mockResolvedValue({
      status: "required",
      verifiedUserId: null,
      verifiedDeviceId: null,
      accessTokenExpiresAt: null,
      lastVerifiedAt: null,
      offlineGraceExpiresAt: null,
      error: null,
      errorCode: null,
    })

    const { useVerificationStore, isAppVerified } = await import("./verification-store")

    useVerificationStore.setState({
      status: "verified",
      verifiedUserId: "user-1",
      verifiedDeviceId: "device-1",
      isHydrated: true,
    })

    await useVerificationStore.getState().signOut()

    expect(mockSignOut).toHaveBeenCalled()
    expect(useVerificationStore.getState().status).toBe("required")
    expect(isAppVerified()).toBe(false)
  })

  it("isAppVerified rejects grace status", async () => {
    mockLoadCachedVerification.mockResolvedValue({
      status: "grace",
      verifiedUserId: "user-1",
      verifiedDeviceId: "device-1",
      accessTokenExpiresAt: Date.now() - 1000,
      lastVerifiedAt: Date.now() - 5000,
      offlineGraceExpiresAt: Date.now() + 1000,
      error: null,
      errorCode: null,
    })

    const { hydrateVerification, isAppVerified } = await import("./verification-store")

    await hydrateVerification()

    expect(isAppVerified()).toBe(false)
  })
})
