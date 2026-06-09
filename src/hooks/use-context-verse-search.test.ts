import { beforeEach, describe, expect, it, vi } from "vitest"
import { runContextVerseSearch } from "./use-context-verse-search"
import type { SemanticSearchResult } from "@/types"

const backendResult: SemanticSearchResult = {
  verse_ref: "John 3:16",
  verse_text: "backend result",
  book_name: "John",
  book_number: 43,
  chapter: 3,
  verse: 16,
  similarity: 0.72,
}

const fuseResult: SemanticSearchResult = {
  verse_ref: "John 3:16",
  verse_text: "fuse result",
  book_name: "John",
  book_number: 43,
  chapter: 3,
  verse: 16,
  similarity: 0.91,
}

describe("runContextVerseSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("merges hybrid and fuse results when both succeed", async () => {
    const invoke = vi.fn().mockResolvedValue([backendResult])
    const importContextSearch = vi.fn().mockResolvedValue({
      mergeContextSearchResults: (
        primary: SemanticSearchResult[],
        fallback: SemanticSearchResult[],
      ) => [...primary, ...fallback],
      searchContextWithFuse: vi.fn().mockResolvedValue([fuseResult]),
    })
    const setSemanticResults = vi.fn()

    await runContextVerseSearch("loved the world", 1, {
      invoke,
      importContextSearch,
      setSemanticResults,
      isStale: () => false,
    })

    expect(invoke).toHaveBeenCalledWith("semantic_search", {
      query: "loved the world",
      limit: 15,
    })
    expect(setSemanticResults).toHaveBeenCalledWith([backendResult, fuseResult])
  })

  it("uses backend results when the fuse module fails to import", async () => {
    const invoke = vi.fn().mockResolvedValue([backendResult])
    const setSemanticResults = vi.fn()

    await runContextVerseSearch("loved the world", 1, {
      invoke,
      importContextSearch: vi.fn().mockResolvedValue(null),
      setSemanticResults,
      isStale: () => false,
    })

    expect(setSemanticResults).toHaveBeenCalledWith([backendResult])
  })

  it("suppresses stale responses", async () => {
    const invoke = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve([backendResult]), 20)
          }),
      )
    const setSemanticResults = vi.fn()

    await runContextVerseSearch("loved the world", 1, {
      invoke,
      importContextSearch: vi.fn().mockResolvedValue({
        mergeContextSearchResults: vi.fn(),
        searchContextWithFuse: vi.fn(),
      }),
      setSemanticResults,
      isStale: () => true,
    })

    expect(setSemanticResults).not.toHaveBeenCalled()
  })

  it("falls back to an empty list when semantic search fails and fuse import fails", async () => {
    const invoke = vi.fn().mockRejectedValue(new Error("offline"))
    const setSemanticResults = vi.fn()

    await runContextVerseSearch("grace", 1, {
      invoke,
      importContextSearch: vi.fn().mockResolvedValue(null),
      setSemanticResults,
      isStale: () => false,
    })

    expect(setSemanticResults).toHaveBeenCalledWith([])
  })
})
