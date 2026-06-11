import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetSupabaseClientForTests } from "@/lib/supabase/client"

const mockRpc = vi.fn()

vi.mock("@/lib/supabase/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/client")>()
  return {
    ...actual,
    getSupabaseClient: () => ({
      rpc: mockRpc,
    }),
  }
})

describe("registerDevice", () => {
  beforeEach(() => {
    resetSupabaseClientForTests()
    mockRpc.mockReset()
  })

  it("returns ok when the RPC reports status ok", async () => {
    mockRpc.mockResolvedValue({ data: { status: "ok" }, error: null })

    const { registerDevice } = await import("@/lib/supabase/devices")
    const result = await registerDevice("device-1", "windows", "0.1.3")

    expect(result).toEqual({ ok: true })
    expect(mockRpc).toHaveBeenCalledWith("register_device", {
      p_device_id: "device-1",
      p_os: "windows",
      p_app_version: "0.1.3",
      p_label: null,
    })
  })

  it("returns device_limit_reached when the RPC reports the limit", async () => {
    mockRpc.mockResolvedValue({ data: { status: "device_limit_reached" }, error: null })

    const { registerDevice } = await import("@/lib/supabase/devices")
    const result = await registerDevice("device-3", "windows", "0.1.3")

    expect(result).toEqual({ ok: false, code: "device_limit_reached" })
  })

  it("returns suspended when the RPC reports a suspended account", async () => {
    mockRpc.mockResolvedValue({ data: { status: "suspended" }, error: null })

    const { registerDevice } = await import("@/lib/supabase/devices")
    const result = await registerDevice("device-1", "windows", "0.1.3")

    expect(result).toEqual({ ok: false, code: "suspended" })
  })

  it("returns error when the RPC fails", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "Not authenticated" },
    })

    const { registerDevice } = await import("@/lib/supabase/devices")
    const result = await registerDevice("device-1", "windows", "0.1.3")

    expect(result).toEqual({
      ok: false,
      code: "error",
      message: "Not authenticated",
    })
  })
})
