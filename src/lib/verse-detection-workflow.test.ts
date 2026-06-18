import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  handleReadingAdvance,
  handleVerseDetections,
} from "./verse-detection-workflow"
import { useBibleStore } from "@/stores/bible-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useDetectionStore } from "@/stores/detection-store"
import { useEgwSlideStore } from "@/stores/egw-slide-store"
import { useQueueStore } from "@/stores/queue-store"
import type { DetectionResult, QueueItem, ReadingAdvance } from "@/types"

const { emitToMock, invokeMock } = vi.hoisted(() => ({
  emitToMock: vi.fn(),
  invokeMock: vi.fn(),
}))

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: emitToMock,
}))

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}))

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(),
}))

function makeDetection(
  overrides: Partial<DetectionResult> = {}
): DetectionResult {
  return {
    verse_ref: "John 3:16",
    verse_text: "For God so loved the world",
    book_name: "John",
    book_number: 43,
    chapter: 3,
    verse: 16,
    confidence: 0.96,
    source: "direct",
    auto_queued: true,
    transcript_snippet: "John three sixteen",
    is_chapter_only: false,
    ...overrides,
  }
}

function makeQueueItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: "chapter-hit",
    presentation: {
      kind: "scripture",
      verse: {
        id: 0,
        translation_id: 7,
        book_number: 43,
        book_name: "John",
        book_abbreviation: "",
        chapter: 3,
        verse: 1,
        text: "Chapter start",
      },
      reference: "John 3",
    },
    confidence: 0.9,
    source: "ai-direct",
    added_at: 100,
    is_chapter_only: true,
    ...overrides,
  }
}

function makeReadingAdvance(
  overrides: Partial<ReadingAdvance> = {}
): ReadingAdvance {
  return {
    book_number: 43,
    book_name: "John",
    chapter: 3,
    verse: 17,
    verse_text: "For God sent not his Son",
    reference: "John 3:17",
    confidence: 1,
    ...overrides,
  }
}

describe("verse detection workflow", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-19T00:00:00Z"))
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "detection-id"),
    })
    emitToMock.mockReset()
    emitToMock.mockResolvedValue(undefined)
    invokeMock.mockReset()
    invokeMock.mockResolvedValue(null)

    useBibleStore.setState({
      translations: [],
      activeTranslationId: 7,
      books: [],
      searchResults: [],
      semanticResults: [],
      selectedVerse: null,
      currentChapter: [],
      crossReferences: [],
      pendingNavigation: null,
    })
    useDetectionStore.setState({
      detections: [],
    })
    useQueueStore.setState({
      items: [],
      activeIndex: null,
      highlightedId: null,
      highlightedIds: [],
    })
    useEgwSlideStore.setState({
      deck: [],
      activeIndex: 0,
    })
    useBroadcastStore.setState({
      isLive: false,
      liveItem: null,
      readingModeAutoLive: true,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("selects a direct verse hit for preview without pending navigation", async () => {
    await handleVerseDetections([makeDetection({ auto_queued: false })])

    expect(useDetectionStore.getState().detections).toHaveLength(1)
    expect(useQueueStore.getState().items).toHaveLength(0)
    expect(useBibleStore.getState().selectedVerse).toMatchObject({
      translation_id: 7,
      book_number: 43,
      book_name: "John",
      chapter: 3,
      verse: 16,
      text: "For God so loved the world",
    })
    expect(useBibleStore.getState().pendingNavigation).toBeNull()
  })

  it("queues an auto-queued direct detection with the active translation", async () => {
    await handleVerseDetections([makeDetection()])

    expect(useQueueStore.getState().items).toEqual([
      expect.objectContaining({
        id: "detection-id",
        confidence: 0.96,
        source: "ai-direct",
        added_at: Date.now(),
        is_chapter_only: false,
        presentation: expect.objectContaining({
          reference: "John 3:16",
          verse: expect.objectContaining({
            translation_id: 7,
            book_number: 43,
            chapter: 3,
            verse: 16,
            text: "For God so loved the world",
          }),
        }),
      }),
    ])
  })

  it("queues semantic detections without pending navigation", async () => {
    await handleVerseDetections([
      makeDetection({
        source: "semantic",
        confidence: 0.72,
        transcript_snippet: "God loved the world and gave his son",
      }),
    ])

    expect(useBibleStore.getState().selectedVerse).toBeNull()
    expect(useBibleStore.getState().pendingNavigation).toBeNull()
    expect(useQueueStore.getState().items).toEqual([
      expect.objectContaining({
        source: "ai-semantic",
        confidence: 0.72,
        presentation: expect.objectContaining({
          reference: "John 3:16",
        }),
      }),
    ])
  })

  it("previews a direct hit over a stronger semantic suggestion", async () => {
    await handleVerseDetections([
      makeDetection({
        source: "semantic",
        verse_ref: "Romans 8:28",
        verse_text: "All things work together for good",
        book_name: "Romans",
        book_number: 45,
        chapter: 8,
        verse: 28,
        confidence: 0.99,
        transcript_snippet: "all things work together for good",
      }),
      makeDetection({
        auto_queued: false,
        confidence: 0.64,
      }),
    ])

    expect(useBibleStore.getState().selectedVerse).toMatchObject({
      book_number: 43,
      chapter: 3,
      verse: 16,
    })
    expect(useQueueStore.getState().items).toEqual([
      expect.objectContaining({
        source: "ai-semantic",
        confidence: 0.99,
        presentation: expect.objectContaining({
          reference: "Romans 8:28",
        }),
      }),
    ])
  })

  it("keeps non-auto-queued semantic detections out of the queue", async () => {
    await handleVerseDetections([
      makeDetection({
        source: "semantic",
        auto_queued: false,
        confidence: 0.79,
      }),
    ])

    expect(useDetectionStore.getState().detections).toHaveLength(1)
    expect(useBibleStore.getState().selectedVerse).toBeNull()
    expect(useQueueStore.getState().items).toHaveLength(0)
  })

  it("queues chapter-only direct detections without selecting preview", async () => {
    await handleVerseDetections([
      makeDetection({
        verse_ref: "John 3",
        verse: 1,
        verse_text: "Chapter start",
        transcript_snippet: "John chapter three",
        is_chapter_only: true,
      }),
    ])

    expect(useBibleStore.getState().selectedVerse).toBeNull()
    expect(useQueueStore.getState().items).toEqual([
      expect.objectContaining({
        source: "ai-direct",
        is_chapter_only: true,
        presentation: expect.objectContaining({
          reference: "John 3",
          verse: expect.objectContaining({
            book_number: 43,
            chapter: 3,
            verse: 1,
          }),
        }),
      }),
    ])
  })

  it("refines a chapter-only queue item instead of adding a duplicate verse", async () => {
    useQueueStore.setState({
      items: [makeQueueItem()],
      activeIndex: null,
      highlightedId: null,
    })

    await handleVerseDetections([makeDetection()])

    expect(useQueueStore.getState().items).toHaveLength(1)
    expect(useQueueStore.getState().items[0]).toMatchObject({
      id: "chapter-hit",
      is_chapter_only: false,
      presentation: expect.objectContaining({
        reference: "John 3:16",
        verse: expect.objectContaining({
          verse: 16,
          text: "For God so loved the world",
        }),
      }),
    })
  })

  it("uses reading-mode advances for preview without queueing or navigation", () => {
    handleReadingAdvance(makeReadingAdvance())

    expect(useBibleStore.getState().selectedVerse).toMatchObject({
      book_number: 43,
      chapter: 3,
      verse: 17,
      text: "For God sent not his Son",
    })
    expect(useBibleStore.getState().pendingNavigation).toBeNull()
    expect(useQueueStore.getState().items).toHaveLength(0)
  })

  it("ignores invalid reading-mode advances", () => {
    handleReadingAdvance(makeReadingAdvance({ book_number: 0 }))

    expect(useBibleStore.getState().selectedVerse).toBeNull()
    expect(useBibleStore.getState().pendingNavigation).toBeNull()
    expect(useQueueStore.getState().items).toHaveLength(0)
  })

  it("does not auto-live normal direct detections", async () => {
    const detection = {
      verse_ref: "John 3:16",
      verse_text: "For God so loved the world.",
      book_name: "John",
      book_number: 43,
      chapter: 3,
      verse: 16,
      confidence: 0.95,
      source: "direct" as const,
      auto_queued: false,
      transcript_snippet: "John 3:16",
      is_chapter_only: false,
    }

    useBroadcastStore.setState({
      isLive: true,
      liveItem: {
        reference: "Romans 8:1 (KJV)",
        segments: [
          { verseNumber: 1, text: "There is therefore now no condemnation." },
        ],
      },
    })

    await handleVerseDetections([detection])

    expect(useBibleStore.getState().selectedVerse).toMatchObject({
      book_name: "John",
      chapter: 3,
      verse: 16,
    })
    expect(useBroadcastStore.getState().liveItem?.reference).toBe(
      "Romans 8:1 (KJV)"
    )
  })

  it("auto-updates live output for reading mode when already live", () => {
    useBroadcastStore.setState({
      isLive: true,
      readingModeAutoLive: true,
      liveItem: {
        reference: "John 3:16 (KJV)",
        segments: [{ verseNumber: 16, text: "For God so loved the world." }],
      },
    })

    handleReadingAdvance({
      book_number: 43,
      book_name: "John",
      chapter: 3,
      verse: 17,
      verse_text:
        "For God sent not his Son into the world to condemn the world.",
      reference: "John 3:17",
      confidence: 0.9,
    })

    expect(useBibleStore.getState().selectedVerse).toMatchObject({
      book_name: "John",
      chapter: 3,
      verse: 17,
    })
    expect(useBroadcastStore.getState().liveItem?.reference).toBe(
      "John 3:17 (KJV)"
    )
    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast",
      "broadcast:verse-update",
      expect.objectContaining({
        item: expect.objectContaining({ reference: "John 3:17 (KJV)" }),
      })
    )
  })

  it("does not auto-update live output for reading mode when the toggle is off", () => {
    useBroadcastStore.setState({
      isLive: true,
      readingModeAutoLive: false,
      liveItem: {
        reference: "John 3:16 (KJV)",
        segments: [{ verseNumber: 16, text: "For God so loved the world." }],
      },
    })

    handleReadingAdvance({
      book_number: 43,
      book_name: "John",
      chapter: 3,
      verse: 17,
      verse_text:
        "For God sent not his Son into the world to condemn the world.",
      reference: "John 3:17",
      confidence: 0.9,
    })

    expect(useBibleStore.getState().selectedVerse).toMatchObject({
      book_name: "John",
      chapter: 3,
      verse: 17,
    })
    expect(useBroadcastStore.getState().liveItem?.reference).toBe(
      "John 3:16 (KJV)"
    )
  })

  it("does not turn live output on for reading mode when hidden", () => {
    useBroadcastStore.setState({
      isLive: false,
      liveItem: null,
    })

    handleReadingAdvance({
      book_number: 43,
      book_name: "John",
      chapter: 3,
      verse: 17,
      verse_text:
        "For God sent not his Son into the world to condemn the world.",
      reference: "John 3:17",
      confidence: 0.9,
    })

    expect(useBibleStore.getState().selectedVerse).toMatchObject({
      book_name: "John",
      chapter: 3,
      verse: 17,
    })
    expect(useBroadcastStore.getState().isLive).toBe(false)
    expect(useBroadcastStore.getState().liveItem).toBeNull()
  })

  it("previews from incoming direct detection event", async () => {
    const detection = makeDetection({
      verse_ref: "Romans 5:8",
      book_number: 45,
      chapter: 5,
      verse: 8,
    })
    await handleVerseDetections([detection])

    expect(useBibleStore.getState().selectedVerse).toMatchObject({
      book_number: 45,
      chapter: 5,
      verse: 8,
    })
  })

  it("previews the highest-confidence direct detection from the incoming batch", async () => {
    const detection1 = makeDetection({
      verse_ref: "Romans 5:8",
      book_number: 45,
      chapter: 5,
      verse: 8,
      confidence: 0.7,
    })
    const detection2 = makeDetection({
      verse_ref: "Romans 8:1",
      book_number: 45,
      chapter: 8,
      verse: 1,
      confidence: 0.95,
    })
    await handleVerseDetections([detection1, detection2])

    expect(useBibleStore.getState().selectedVerse).toMatchObject({
      book_number: 45,
      chapter: 8,
      verse: 1,
    })
  })

  it("previews EGW direct detections without selecting a Bible verse", async () => {
    await handleVerseDetections([
      makeDetection({
        content_type: "egw",
        verse_ref: "Patriarchs and Prophets 1:2",
        verse_text: "The history of the great conflict.",
        book_name: "Patriarchs and Prophets",
        book_number: 1,
        chapter: 1,
        verse: 2,
        auto_queued: false,
        egw_paragraph: {
          id: 12,
          book_number: 1,
          book_title: "Patriarchs and Prophets",
          chapter: 1,
          chapter_title: "Why Was Sin Permitted?",
          paragraph: 2,
          text: "The history of the great conflict.",
        },
      }),
    ])

    expect(useBibleStore.getState().selectedVerse).toBeNull()
    expect(useEgwSlideStore.getState().deck[0]).toMatchObject({
      kind: "egw",
      reference: "Patriarchs and Prophets 1:2",
    })
    expect(useBroadcastStore.getState().previewItem).toMatchObject({
      kind: "egw",
      reference: "Patriarchs and Prophets 1:2",
    })
  })

  it("keeps the first direct hit when confidence is tied", async () => {
    const detection1 = makeDetection({
      verse_ref: "Romans 5:8",
      book_number: 45,
      chapter: 5,
      verse: 8,
      confidence: 0.9,
    })
    const detection2 = makeDetection({
      verse_ref: "Romans 8:1",
      book_number: 45,
      chapter: 8,
      verse: 1,
      confidence: 0.9,
    })
    await handleVerseDetections([detection1, detection2])

    expect(useBibleStore.getState().selectedVerse).toMatchObject({
      book_number: 45,
      chapter: 5,
      verse: 8,
    })
  })

  it("serializes overlapping detection batches", async () => {
    const order: string[] = []
    invokeMock.mockImplementation(async () => {
      order.push("fetch")
      return null
    })

    const first = handleVerseDetections([
      makeDetection({ verse_ref: "John 3:16", auto_queued: true }),
    ])
    const second = handleVerseDetections([
      makeDetection({
        verse_ref: "Romans 8:1",
        book_number: 45,
        chapter: 8,
        verse: 1,
        auto_queued: true,
      }),
    ])

    await Promise.all([first, second])
    expect(order.length).toBeGreaterThan(0)
    expect(useQueueStore.getState().items.length).toBeGreaterThanOrEqual(2)
  })

  it("reports a verse lookup issue when fetch fails and fallback text is used", async () => {
    useBroadcastStore.setState({ outputIssues: [] })
    invokeMock.mockRejectedValueOnce(new Error("network down"))

    await handleVerseDetections([
      makeDetection({ verse_text: "Fallback verse text" }),
    ])

    expect(useBroadcastStore.getState().outputIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "verse-lookup",
          outputId: "global",
        }),
      ])
    )
  })

  it("reports unexpected detection batch errors instead of swallowing them", async () => {
    useBroadcastStore.setState({ outputIssues: [] })
    const originalAddDetections = useDetectionStore.getState().addDetections
    useDetectionStore.setState({
      addDetections: () => {
        throw new Error("batch exploded")
      },
    })

    await handleVerseDetections([makeDetection()])

    expect(useBroadcastStore.getState().outputIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outputId: "global",
          kind: "auto-detection",
          title: "Detection batch failed",
        }),
      ])
    )

    useDetectionStore.setState({ addDetections: originalAddDetections })
  })

  it("queues text fetched from the current translation", async () => {
    invokeMock.mockResolvedValueOnce({
      id: 25,
      translation_id: 7,
      book_number: 43,
      book_name: "John",
      book_abbreviation: "John",
      chapter: 3,
      verse: 16,
      text: "Current translation text",
    })

    await handleVerseDetections([
      makeDetection({ verse_text: "Text from the earlier translation" }),
    ])

    const presentation = useQueueStore.getState().items[0].presentation
    expect(
      presentation.kind === "scripture" ? presentation.verse.text : null
    ).toBe("Current translation text")
  })

  it("previews text fetched from the current translation", async () => {
    invokeMock.mockResolvedValue({
      id: 25,
      translation_id: 7,
      book_number: 43,
      book_name: "John",
      book_abbreviation: "John",
      chapter: 3,
      verse: 16,
      text: "Current translation preview text",
    })

    await handleVerseDetections([
      makeDetection({
        auto_queued: false,
        verse_text: "Detection event text",
      }),
    ])

    expect(useBibleStore.getState().selectedVerse?.text).toBe(
      "Current translation preview text"
    )
    expect(useBroadcastStore.getState().previewItem?.segments[0]?.text).toBe(
      "Current translation preview text"
    )
  })

  it("falls back to loaded current chapter text when verse fetch is unavailable", async () => {
    useBibleStore.setState({
      currentChapter: [
        {
          id: 25,
          translation_id: 7,
          book_number: 43,
          book_name: "John",
          book_abbreviation: "John",
          chapter: 3,
          verse: 16,
          text: "Loaded current chapter text",
        },
      ],
    })

    await handleVerseDetections([
      makeDetection({ verse_text: "Text from the earlier translation" }),
    ])

    const presentation = useQueueStore.getState().items[0].presentation
    expect(
      presentation.kind === "scripture" ? presentation.verse.text : null
    ).toBe("Loaded current chapter text")
  })
})
