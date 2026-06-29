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

describe("announcements supabase lib", () => {
  beforeEach(() => {
    resetSupabaseClientForTests()
    mockRpc.mockReset()
  })

  it("fetchActiveAnnouncements returns published rows", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          id: "a1",
          title: "Hello",
          body: "World",
          published_at: null,
          expires_at: null,
        },
      ],
      error: null,
    })

    const { fetchActiveAnnouncements } =
      await import("@/lib/supabase/announcements")
    const result = await fetchActiveAnnouncements()

    expect(result).toEqual({
      ok: true,
      announcements: [
        {
          id: "a1",
          title: "Hello",
          body: "World",
          published_at: null,
          expires_at: null,
        },
      ],
    })
    expect(mockRpc).toHaveBeenCalledWith("fetch_active_announcements")
  })

  it("adminListAnnouncements returns valid admin rows", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          id: "a1",
          title: "Hello",
          body: "World",
          status: "draft",
          published_at: null,
          expires_at: "2026-07-01T00:00:00.000Z",
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-02T00:00:00.000Z",
        },
      ],
      error: null,
    })

    const { adminListAnnouncements } =
      await import("@/lib/supabase/announcements")
    const result = await adminListAnnouncements()

    expect(result).toEqual({
      ok: true,
      announcements: [
        {
          id: "a1",
          title: "Hello",
          body: "World",
          status: "draft",
          published_at: null,
          expires_at: "2026-07-01T00:00:00.000Z",
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-02T00:00:00.000Z",
        },
      ],
    })
    expect(mockRpc).toHaveBeenCalledWith("admin_list_announcements")
  })

  it("adminListAnnouncements filters malformed admin rows", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          id: "a1",
          title: "Hello",
          body: "World",
          status: "published",
          published_at: null,
          expires_at: null,
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-02T00:00:00.000Z",
        },
        {
          id: "a2",
          title: "Broken",
          body: "World",
          status: "archived",
          published_at: null,
          expires_at: null,
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-02T00:00:00.000Z",
        },
        {
          id: "a3",
          title: "Missing dates",
          body: "World",
          status: "draft",
        },
      ],
      error: null,
    })

    const { adminListAnnouncements } =
      await import("@/lib/supabase/announcements")
    const result = await adminListAnnouncements()

    expect(result).toEqual({
      ok: true,
      announcements: [
        {
          id: "a1",
          title: "Hello",
          body: "World",
          status: "published",
          published_at: null,
          expires_at: null,
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-02T00:00:00.000Z",
        },
      ],
    })
  })

  it("adminCreateAnnouncement returns the new id", async () => {
    mockRpc.mockResolvedValue({ data: "new-id", error: null })

    const { adminCreateAnnouncement } =
      await import("@/lib/supabase/announcements")
    const result = await adminCreateAnnouncement("Title", "Body")

    expect(result).toEqual({ ok: true, id: "new-id" })
    expect(mockRpc).toHaveBeenCalledWith("admin_create_announcement", {
      p_title: "Title",
      p_body: "Body",
    })
  })

  it("adminUpdateAnnouncement surfaces RPC errors", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "Admin access required" },
    })

    const { adminUpdateAnnouncement } =
      await import("@/lib/supabase/announcements")
    const result = await adminUpdateAnnouncement({
      id: "a1",
      status: "published",
    })

    expect(result).toEqual({ ok: false, message: "Admin access required" })
    expect(mockRpc).toHaveBeenCalledWith("admin_update_announcement", {
      p_id: "a1",
      p_status: "published",
    })
  })

  it("adminUpdateAnnouncement sends only changed optional fields", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    const { adminUpdateAnnouncement } =
      await import("@/lib/supabase/announcements")
    const result = await adminUpdateAnnouncement({
      id: "a1",
      title: "Updated",
      body: "New body",
    })

    expect(result).toEqual({ ok: true })
    expect(mockRpc).toHaveBeenCalledWith("admin_update_announcement", {
      p_id: "a1",
      p_title: "Updated",
      p_body: "New body",
    })
  })

  it("adminDeleteAnnouncement calls the delete RPC", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    const { adminDeleteAnnouncement } =
      await import("@/lib/supabase/announcements")
    const result = await adminDeleteAnnouncement("a1")

    expect(result).toEqual({ ok: true })
    expect(mockRpc).toHaveBeenCalledWith("admin_delete_announcement", {
      p_id: "a1",
    })
  })
})
