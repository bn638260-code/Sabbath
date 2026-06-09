import { describe, expect, it, vi } from "vitest"
import {
  BIBLE_CHAPTER_COUNTS,
  buildQueuedVerseKeys,
  chapterCountForBook,
  resolveEffectiveVerseId,
} from "./search-panel-state"
import type { Book, QueueItem, Verse } from "@/types"

const mockInvoke = vi.fn()
const setActiveTranslation = vi.fn()

vi.mock("@/lib/tauri-runtime", () => ({
  invokeTauri: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock("@/stores/bible-store", () => ({
  useBibleStore: {
    getState: () => ({
      setActiveTranslation,
    }),
  },
}))

const genesis: Book = {
  id: 1,
  translation_id: 1,
  book_number: 1,
  name: "Genesis",
  abbreviation: "Gen",
  testament: "OT",
}

const john: Book = {
  id: 43,
  translation_id: 1,
  book_number: 43,
  name: "John",
  abbreviation: "John",
  testament: "NT",
}

describe("search-panel-state", () => {
  describe("chapterCountForBook", () => {
    it("returns chapter counts from the canonical table", () => {
      expect(chapterCountForBook(genesis)).toBe(BIBLE_CHAPTER_COUNTS[0])
      expect(chapterCountForBook(john)).toBe(BIBLE_CHAPTER_COUNTS[42])
    })

    it("defaults to 1 when no book is selected", () => {
      expect(chapterCountForBook(null)).toBe(1)
    })
  })

  describe("buildQueuedVerseKeys", () => {
    it("builds verse keys for scripture queue items", () => {
      const items = [
        {
          id: "1",
          presentation: {
            kind: "scripture" as const,
            reference: "John 3:16",
            verse: {
              id: 1,
              translation_id: 1,
              book_number: 43,
              book_name: "John",
              book_abbreviation: "John",
              chapter: 3,
              verse: 16,
              text: "For God so loved the world.",
            },
          },
          confidence: 1,
          source: "manual" as const,
          added_at: 1,
        },
      ] satisfies QueueItem[]

      expect(buildQueuedVerseKeys(items)).toEqual(new Set(["43:3:16"]))
    })

    it("ignores non-scripture queue items", () => {
      const items = [
        {
          id: "1",
          presentation: {
            kind: "hymn" as const,
            hymnId: "h-1",
            hymnNumber: 1,
            hymnTitle: "Praise",
            screenId: "screen-1",
            slideIndex: 0,
            slideCount: 1,
            reference: "Hymn 1",
            segments: [{ text: "Praise to the Lord" }],
          },
          confidence: 1,
          source: "manual" as const,
          added_at: 1,
        },
      ] satisfies QueueItem[]

      expect(buildQueuedVerseKeys(items)).toEqual(new Set())
    })
  })

  describe("resolveEffectiveVerseId", () => {
    const chapter: Verse[] = [
      {
        id: 100,
        translation_id: 1,
        book_number: 43,
        book_name: "John",
        book_abbreviation: "John",
        chapter: 3,
        verse: 16,
        text: "For God so loved the world.",
      },
      {
        id: 101,
        translation_id: 1,
        book_number: 43,
        book_name: "John",
        book_abbreviation: "John",
        chapter: 3,
        verse: 17,
        text: "For God sent not his Son.",
      },
    ]

    it("returns the selected id when it still exists in the chapter", () => {
      expect(resolveEffectiveVerseId(100, chapter, chapter[0])).toBe(100)
    })

    it("remaps by verse number after translation reload", () => {
      const selectedVerse = { ...chapter[0], id: 999 }
      expect(resolveEffectiveVerseId(999, chapter, selectedVerse)).toBe(100)
    })

    it("returns null when nothing is selected", () => {
      expect(resolveEffectiveVerseId(null, chapter, null)).toBeNull()
    })
  })

  describe("changeActiveTranslation", () => {
    it("invokes set_active_translation and updates the store", async () => {
      mockInvoke.mockResolvedValue(undefined)
      const { changeActiveTranslation } = await import("./search-panel-state")

      await changeActiveTranslation(2)

      expect(mockInvoke).toHaveBeenCalledWith("set_active_translation", {
        translationId: 2,
      })
      expect(setActiveTranslation).toHaveBeenCalledWith(2)
    })
  })
})
