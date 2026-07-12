import { beforeEach, describe, expect, it } from "vitest"
import { useCollectedDetectionsStore } from "./collected-detections-store"
import type { DetectionResult } from "@/types"

const baseDetection: DetectionResult = {
  verse_ref: "John 3:16",
  verse_text: "For God so loved the world.",
  book_name: "John",
  book_number: 43,
  chapter: 3,
  verse: 16,
  confidence: 0.96,
  source: "direct",
  auto_queued: false,
  transcript_snippet: "John chapter three verse sixteen",
  is_chapter_only: false,
}

beforeEach(() => {
  useCollectedDetectionsStore.getState().clear()
})

describe("useCollectedDetectionsStore", () => {
  it("records acted-on detections most-recent-first", () => {
    const second = {
      ...baseDetection,
      verse_ref: "Romans 8:1",
      verse_text: "There is therefore now no condemnation.",
    }

    useCollectedDetectionsStore.getState().record(baseDetection, 100)
    useCollectedDetectionsStore.getState().record(second, 200)

    expect(
      useCollectedDetectionsStore.getState().items.map((item) => item.reference)
    ).toEqual(["Romans 8:1", "John 3:16"])
  })

  it("dedupes by normalized kind and reference while bumping use count", () => {
    useCollectedDetectionsStore.getState().record(baseDetection, 100)
    useCollectedDetectionsStore.getState().record(
      {
        ...baseDetection,
        verse_ref: "  john   3:16 ",
        verse_text: "Updated text.",
      },
      200
    )

    const [item] = useCollectedDetectionsStore.getState().items
    expect(useCollectedDetectionsStore.getState().items).toHaveLength(1)
    expect(item.useCount).toBe(2)
    expect(item.firstUsedAt).toBe(100)
    expect(item.lastUsedAt).toBe(200)
    expect(item.text).toBe("Updated text.")
  })

  it("removes and clears collected detections", () => {
    useCollectedDetectionsStore.getState().record(baseDetection, 100)
    const key = useCollectedDetectionsStore.getState().items[0].key

    useCollectedDetectionsStore.getState().remove(key)
    expect(useCollectedDetectionsStore.getState().items).toEqual([])

    useCollectedDetectionsStore.getState().record(baseDetection, 200)
    useCollectedDetectionsStore.getState().clear()
    expect(useCollectedDetectionsStore.getState().items).toEqual([])
  })
})
