import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetSupabaseClientForTests } from "@/lib/supabase/client"

const mockRpc = vi.fn()
const mockFunctionsInvoke = vi.fn()
const signedLease = { payload: "lease-payload", signature: "lease-signature" }

vi.mock("@/lib/supabase/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/client")>()
  return {
    ...actual,
    getSupabaseClient: () => ({
      rpc: mockRpc,
      functions: { invoke: mockFunctionsInvoke },
    }),
  }
})

vi.mock("@/lib/verification/device-id", () => ({
  signInstallationChallenge: vi.fn().mockResolvedValue("installation-signature"),
  getOrCreateInstallationIdentity: vi.fn().mockResolvedValue({
    deviceId: "device-1",
    publicKey: "public-key",
  }),
}))

describe("registerDevice", () => {
  beforeEach(() => {
    resetSupabaseClientForTests()
    mockRpc.mockReset()
    mockFunctionsInvoke.mockReset()
  })

  it("returns ok with access expiry when the RPC reports status ok", async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: {
        registration: {
          status: "ok",
          access_expires_at: "2026-07-01T00:00:00.000Z",
          is_church_organization: true,
          church_name: "Central SDA Church",
        },
        lease: signedLease,
      },
      error: null,
    })

    const { registerDevice } = await import("@/lib/supabase/devices")
    const result = await registerDevice(
      "user-1",
      "device-1",
      "windows",
      "0.1.3",
      "public-key"
    )

    expect(result).toEqual({
      ok: true,
      accessExpiresAt: Date.parse("2026-07-01T00:00:00.000Z"),
      isChurchOrganization: true,
      churchName: "Central SDA Church",
      lease: signedLease,
    })
    expect(mockFunctionsInvoke).toHaveBeenCalledWith(
      "device-activation",
      expect.objectContaining({ body: expect.objectContaining({ deviceId: "device-1" }) })
    )
  })

  it("returns device_limit_reached when the RPC reports the limit", async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: { registration: { status: "device_limit_reached" } },
      error: null,
    })

    const { registerDevice } = await import("@/lib/supabase/devices")
    const result = await registerDevice("user-1", "device-3", "windows", "0.1.3", "public-key")

    expect(result).toEqual({ ok: false, code: "device_limit_reached" })
  })

  it.each(["device_pending", "device_revoked"] as const)(
    "returns %s when the activation is not usable",
    async (status) => {
      mockFunctionsInvoke.mockResolvedValue({
        data: { registration: { status } },
        error: null,
      })

      const { registerDevice } = await import("@/lib/supabase/devices")
      const result = await registerDevice("user-1", "device-2", "windows", "0.1.7", "public-key")

      expect(result).toEqual({ ok: false, code: status })
    }
  )

  it("returns suspended when the RPC reports a suspended account", async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: { registration: { status: "suspended" } },
      error: null,
    })

    const { registerDevice } = await import("@/lib/supabase/devices")
    const result = await registerDevice("user-1", "device-1", "windows", "0.1.3", "public-key")

    expect(result).toEqual({ ok: false, code: "suspended" })
  })

  it("returns trial_expired when the RPC reports ended access", async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: { registration: { status: "trial_expired" } },
      error: null,
    })

    const { registerDevice } = await import("@/lib/supabase/devices")
    const result = await registerDevice("user-1", "device-1", "windows", "0.1.3", "public-key")

    expect(result).toEqual({ ok: false, code: "trial_expired" })
  })

  it("returns error when the RPC fails", async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: null,
      error: { message: "Not authenticated" },
    })

    const { registerDevice } = await import("@/lib/supabase/devices")
    const result = await registerDevice("user-1", "device-1", "windows", "0.1.3", "public-key")

    expect(result).toEqual({
      ok: false,
      code: "error",
      message: "Not authenticated",
    })
  })

  it("lists and normalizes the signed-in account's computers", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          device_id: "device-1",
          os: "windows",
          app_version: "0.1.7",
          label: "Media desk",
          status: "approved",
          first_seen_at: "2026-07-01T00:00:00.000Z",
          last_seen_at: "2026-07-16T00:00:00.000Z",
          approved_at: "2026-07-01T00:00:00.000Z",
          revoked_at: null,
        },
      ],
      error: null,
    })

    const { listOwnDevices } = await import("@/lib/supabase/devices")
    const result = await listOwnDevices()

    expect(result).toEqual({
      ok: true,
      devices: [
        {
          deviceId: "device-1",
          os: "windows",
          appVersion: "0.1.7",
          label: "Media desk",
          status: "approved",
          firstSeenAt: "2026-07-01T00:00:00.000Z",
          lastSeenAt: "2026-07-16T00:00:00.000Z",
          approvedAt: "2026-07-01T00:00:00.000Z",
          revokedAt: null,
        },
      ],
    })
    expect(mockRpc).toHaveBeenCalledWith("list_own_devices")
  })

  it("deactivates one of the signed-in account's computers", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    const { deactivateOwnDevice } = await import("@/lib/supabase/devices")

    await expect(deactivateOwnDevice("device-1")).resolves.toEqual({ ok: true })
    expect(mockRpc).toHaveBeenCalledWith("deactivate_own_device", {
      p_device_id: "device-1",
    })
  })

  it("lets an admin approve a pending computer", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    const { adminSetDeviceStatus } = await import("@/lib/supabase/devices")

    await expect(
      adminSetDeviceStatus("user-1", "device-2", "approved")
    ).resolves.toEqual({ ok: true })
    expect(mockRpc).toHaveBeenCalledWith("admin_set_device_status", {
      p_user_id: "user-1",
      p_device_id: "device-2",
      p_status: "approved",
    })
  })

  it("lets an approved computer sign approval for a pending computer", async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: { status: "approved" },
      error: null,
    })
    const { approveOwnDevice } = await import("@/lib/supabase/devices")

    await expect(approveOwnDevice("user-1", "device-2")).resolves.toEqual({
      ok: true,
    })
    expect(mockFunctionsInvoke).toHaveBeenCalledWith(
      "device-activation",
      expect.objectContaining({
        body: expect.objectContaining({
          action: "approve",
          deviceId: "device-1",
          targetDeviceId: "device-2",
        }),
      })
    )
  })
})
