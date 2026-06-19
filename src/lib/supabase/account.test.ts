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

describe("supabase account lib", () => {
  beforeEach(() => {
    resetSupabaseClientForTests()
    mockRpc.mockReset()
  })

  it("fetchIsAdmin returns true only when the RPC returns true", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    const { fetchIsAdmin } = await import("@/lib/supabase/account")
    const result = await fetchIsAdmin()

    expect(result).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith("is_app_admin")
  })

  it("fetchIsAdmin returns false when the RPC errors", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "Not authenticated" },
    })

    const { fetchIsAdmin } = await import("@/lib/supabase/account")
    const result = await fetchIsAdmin()

    expect(result).toBe(false)
  })

  it("adminListAccounts returns account rows", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          user_id: "user-1",
          email: "user@example.com",
          created_at: "2026-01-01T00:00:00.000Z",
          suspended: false,
          suspend_reason: null,
          device_count: 1,
          last_seen_at: null,
          is_admin: true,
        },
      ],
      error: null,
    })

    const { adminListAccounts } = await import("@/lib/supabase/account")
    const result = await adminListAccounts()

    expect(result).toEqual({
      ok: true,
      accounts: [
        {
          user_id: "user-1",
          email: "user@example.com",
          created_at: "2026-01-01T00:00:00.000Z",
          suspended: false,
          suspend_reason: null,
          device_count: 1,
          last_seen_at: null,
          is_admin: true,
        },
      ],
    })
    expect(mockRpc).toHaveBeenCalledWith("admin_list_accounts")
  })

  it("adminSetSuspended sends the expected RPC payload", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    const { adminSetSuspended } = await import("@/lib/supabase/account")
    const result = await adminSetSuspended("user-1", true, "billing issue")

    expect(result).toEqual({ ok: true })
    expect(mockRpc).toHaveBeenCalledWith("admin_set_suspended", {
      p_user_id: "user-1",
      p_suspended: true,
      p_reason: "billing issue",
    })
  })

  it("adminSetSuspended sends the expected reinstatement payload", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    const { adminSetSuspended } = await import("@/lib/supabase/account")
    const result = await adminSetSuspended("user-1", false)

    expect(result).toEqual({ ok: true })
    expect(mockRpc).toHaveBeenCalledWith("admin_set_suspended", {
      p_user_id: "user-1",
      p_suspended: false,
      p_reason: null,
    })
  })

  it("adminDeleteAccount surfaces RPC errors", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "Admin accounts cannot be deleted" },
    })

    const { adminDeleteAccount } = await import("@/lib/supabase/account")
    const result = await adminDeleteAccount("admin-1")

    expect(result).toEqual({
      ok: false,
      message: "Admin accounts cannot be deleted",
    })
  })

  it("deleteOwnAccount calls the self-delete RPC", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    const { deleteOwnAccount } = await import("@/lib/supabase/account")
    const result = await deleteOwnAccount()

    expect(result).toEqual({ ok: true })
    expect(mockRpc).toHaveBeenCalledWith("delete_own_account")
  })
})
