import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGet = vi.fn()
const mockSet = vi.fn()
const mockDelete = vi.fn()
const mockSave = vi.fn()
const mockInvoke = vi.fn()

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(async () => ({
    get: mockGet,
    set: mockSet,
    delete: mockDelete,
    save: mockSave,
  })),
}))

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}))

describe("verification-store", () => {
  beforeEach(() => {
    vi.resetModules()
    mockGet.mockReset()
    mockSet.mockReset()
    mockDelete.mockReset()
    mockSave.mockReset()
    mockInvoke.mockReset()
  })

  it("fails closed when no keychain token exists", async () => {
    mockInvoke.mockResolvedValue(false)
    const { hydrateVerification, useVerificationStore, isAppVerified } = await import(
      "./verification-store"
    )

    await hydrateVerification()

    expect(useVerificationStore.getState().status).toBe("required")
    expect(isAppVerified()).toBe(false)
  })

  it("verifies a local mock device and stores only metadata in app store", async () => {
    mockInvoke.mockResolvedValueOnce("token")
    const { useVerificationStore, isAppVerified } = await import("./verification-store")

    await useVerificationStore.getState().verifyDevice()

    expect(mockInvoke).toHaveBeenCalledWith("rotate_verification_token", undefined)
    expect(mockSet).toHaveBeenCalledWith("metadata", expect.objectContaining({
      verifiedUserId: "creator-local",
    }))
    expect(useVerificationStore.getState().status).toBe("verified")
    expect(isAppVerified()).toBe(true)
  })

  it("treats expired cached token within grace as verified enough for app entry", async () => {
    const now = Date.now()
    mockInvoke.mockResolvedValue(true)
    mockGet.mockResolvedValue({
      verifiedUserId: "user",
      verifiedDeviceId: "device",
      accessTokenExpiresAt: now - 1000,
      lastVerifiedAt: now - 5000,
      offlineGraceExpiresAt: now + 1000,
    })
    const { hydrateVerification, useVerificationStore, isAppVerified } = await import(
      "./verification-store"
    )

    await hydrateVerification()

    expect(useVerificationStore.getState().status).toBe("grace")
    expect(isAppVerified()).toBe(true)
  })
})
