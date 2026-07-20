import { beforeEach, describe, expect, it, vi } from "vitest"

const mockRpc = vi.fn()

vi.mock("@/lib/supabase/rpc", () => ({
  callRpc: (...args: unknown[]) => mockRpc(...args),
}))

describe("pilot access", () => {
  beforeEach(() => mockRpc.mockReset())

  it("redeems an invitation with training acknowledgement", async () => {
    mockRpc.mockResolvedValue({ ok: true, data: { status: "ok" } })
    const { redeemPilotInvite } = await import("./pilot")
    await expect(redeemPilotInvite("INVITE-CODE-123456", true)).resolves.toEqual({ ok: true })
    expect(mockRpc).toHaveBeenCalledWith("redeem_pilot_invite", expect.objectContaining({
      args: { p_code: "INVITE-CODE-123456", p_training_acknowledged: true },
    }))
  })

  it("does not expose an invite code when creation fails", async () => {
    vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => bytes.fill(1) })
    mockRpc.mockResolvedValue({ ok: false, message: "denied" })
    const { adminCreatePilotInvite } = await import("./pilot")
    await expect(adminCreatePilotInvite("church-1", "operator", "2026-08-01T00:00:00Z"))
      .resolves.toEqual({ ok: false, message: "denied" })
    vi.unstubAllGlobals()
  })

  it("explains that email confirmation is required before redemption", async () => {
    mockRpc.mockResolvedValue({
      ok: true,
      data: { status: "email_confirmation_required" },
    })
    const { redeemPilotInvite } = await import("./pilot")

    await expect(redeemPilotInvite("INVITE-CODE-123456", true)).resolves.toEqual({
      ok: false,
      message: "Confirm your email address before using an invitation.",
    })
  })
})
