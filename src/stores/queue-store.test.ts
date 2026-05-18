import { beforeEach, describe, expect, it, vi } from "vitest"
import { useQueueStore } from "./queue-store"
import type { QueueItem } from "@/types"

function makeItem(id: string, verse: number): QueueItem {
  return {
    id,
    reference: `John 3:${verse}`,
    verse: {
      id: verse,
      translation_id: 1,
      book_number: 43,
      book_name: "John",
      book_abbreviation: "John",
      chapter: 3,
      verse,
      text: `Verse ${verse}`,
    },
    confidence: 0.95,
    source: "manual",
    added_at: Date.now(),
  }
}

describe("queue-store", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useQueueStore.setState({
      items: [],
      activeIndex: null,
      highlightedId: null,
    })
  })

  it("keeps the same active item after removing an earlier item", () => {
    useQueueStore.setState({
      items: [makeItem("a", 16), makeItem("b", 17), makeItem("c", 18)],
      activeIndex: 1,
      highlightedId: null,
    })

    useQueueStore.getState().removeItem("a")

    expect(useQueueStore.getState().items.map((i) => i.id)).toEqual(["b", "c"])
    expect(useQueueStore.getState().activeIndex).toBe(0)
  })

  it("keeps the same active item after reorder", () => {
    useQueueStore.setState({
      items: [makeItem("a", 16), makeItem("b", 17), makeItem("c", 18)],
      activeIndex: 1,
      highlightedId: null,
    })

    useQueueStore.getState().reorderItems(1, 0)

    expect(useQueueStore.getState().items.map((i) => i.id)).toEqual(["b", "a", "c"])
    expect(useQueueStore.getState().activeIndex).toBe(0)
  })

  it("flashes instead of adding duplicate detection item", () => {
    useQueueStore.setState({
      items: [makeItem("a", 16)],
      activeIndex: null,
      highlightedId: null,
    })

    const result = useQueueStore.getState().addOrFlashDetectionItem(makeItem("dup", 16))

    expect(result).toBe("duplicate")
    expect(useQueueStore.getState().items).toHaveLength(1)
    expect(useQueueStore.getState().highlightedId).toBe("a")
  })
})
