// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import type { QueueItem } from "@/types"
import {
  clampQueueNextIndex,
  clampQueuePrevIndex,
  dispatchRemoteNavigation,
  findCurrentVerseIndex,
  parsePayload,
  resolveRemoteNextIndex,
  resolveRemotePrevIndex,
} from "./use-remote-control-logic"

function scriptureItem(reference: string, book = 43, chapter = 3, verse = 16): QueueItem {
  return {
    id: reference,
    confidence: 1,
    source: "manual",
    added_at: 0,
    presentation: {
      kind: "scripture",
      reference,
      verse: {
        id: 1,
        translation_id: 1,
        book_number: book,
        book_name: "John",
        book_abbreviation: "Jn",
        chapter,
        verse,
        text: "For God so loved the world.",
      },
    },
  }
}

describe("parsePayload", () => {
  it("parses JSON string payloads", () => {
    expect(parsePayload('{"name":"Classic Dark"}')).toEqual({ name: "Classic Dark" })
  })

  it("returns null for invalid JSON", () => {
    expect(parsePayload("{bad")).toBeNull()
  })

  it("accepts record objects", () => {
    expect(parsePayload({ value: 0.9 })).toEqual({ value: 0.9 })
  })
})

describe("findCurrentVerseIndex", () => {
  const items = [
    scriptureItem("John 3:16 (KJV)"),
    scriptureItem("John 3:17 (KJV)", 43, 3, 17),
  ]

  it("finds the live reference in the queue", () => {
    expect(findCurrentVerseIndex(items, "John 3:17 (KJV)")).toBe(1)
  })

  it("returns null when live reference is missing", () => {
    expect(findCurrentVerseIndex(items, "Romans 8:28 (KJV)")).toBeNull()
  })
})

describe("queue navigation clamping", () => {
  it("clamps next at the end of the queue", () => {
    expect(clampQueueNextIndex(1, 2)).toBe(1)
    expect(clampQueueNextIndex(null, 2)).toBe(0)
  })

  it("clamps prev at the start of the queue", () => {
    expect(clampQueuePrevIndex(0, 2)).toBe(0)
    expect(clampQueuePrevIndex(null, 2)).toBe(0)
  })

  it("resolves next and prev indices from live reference", () => {
    const items = [
      scriptureItem("John 3:16 (KJV)"),
      scriptureItem("John 3:17 (KJV)", 43, 3, 17),
    ]
    expect(
      resolveRemoteNextIndex({
        items,
        activeIndex: null,
        liveReference: "John 3:16 (KJV)",
      }),
    ).toBe(1)
    expect(
      resolveRemotePrevIndex({
        items,
        activeIndex: null,
        liveReference: "John 3:17 (KJV)",
      }),
    ).toBe(0)
  })
})

describe("dispatchRemoteNavigation", () => {
  it("sets active index and presents the next queue item", () => {
    const items = [
      scriptureItem("John 3:16 (KJV)"),
      scriptureItem("John 3:17 (KJV)", 43, 3, 17),
    ]
    const setActive = vi.fn()
    const present = vi.fn()

    dispatchRemoteNavigation(
      "next",
      { items, activeIndex: 0, liveReference: null },
      present,
      setActive,
    )

    expect(setActive).toHaveBeenCalledWith(1)
    expect(present).toHaveBeenCalledWith(1)
  })
})
