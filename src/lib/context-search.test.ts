import { beforeEach, describe, expect, it, vi } from "vitest"
import { clearContextSearchCache, searchContextWithFuse } from "./context-search"
import { invoke } from "@tauri-apps/api/core"

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}))

const mockInvoke = vi.mocked(invoke)

describe("searchContextWithFuse", () => {
  beforeEach(() => {
    clearContextSearchCache()
    mockInvoke.mockReset()
  })

  it("returns matching verse results from the active translation", async () => {
    mockInvoke.mockResolvedValueOnce([
      {
        book_number: 43,
        book_name: "John",
        chapter: 3,
        verse: 16,
        text: "For God so loved the world that he gave his only begotten Son.",
      },
      {
        book_number: 19,
        book_name: "Psalms",
        chapter: 23,
        verse: 1,
        text: "The Lord is my shepherd; I shall not want.",
      },
    ])

    const results = await searchContextWithFuse("loved the world", 1)

    expect(results[0]).toEqual(
      expect.objectContaining({
        verse_ref: "John 3:16",
        book_name: "John",
        chapter: 3,
        verse: 16,
      }),
    )
    expect(mockInvoke).toHaveBeenCalledWith("get_translation_verses_for_search", {
      translationId: 1,
    })
  })

  it("reuses the cached index for repeated searches in the same translation", async () => {
    mockInvoke.mockResolvedValueOnce([
      {
        book_number: 43,
        book_name: "John",
        chapter: 3,
        verse: 16,
        text: "For God so loved the world that he gave his only begotten Son.",
      },
    ])

    await searchContextWithFuse("loved world", 1)
    await searchContextWithFuse("begotten son", 1)

    expect(mockInvoke).toHaveBeenCalledTimes(1)
  })
})
