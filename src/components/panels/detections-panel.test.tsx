// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DetectionsPanel } from "./detections-panel"
import { useSettingsStore } from "@/stores/settings-store"
import type { DetectionResult, Verse } from "@/types"

const {
  clearDetectionsMock,
  detection,
  hymnDetection,
  detectionsRef,
  presentVerseMock,
  selectPreviewVerseMock,
  presentHymnMock,
  previewHymnMock,
  queueHymnMock,
  verse,
} = vi.hoisted(() => {
  const detection: DetectionResult = {
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

  const hymnDetection: DetectionResult = {
    content_type: "hymn",
    verse_ref: "Hymn 46",
    verse_text: "Holy, Holy, Holy",
    book_name: "Hymn",
    book_number: 0,
    chapter: 0,
    verse: 46,
    confidence: 1,
    source: "direct",
    auto_queued: false,
    transcript_snippet: "",
    is_chapter_only: false,
    hymn: { number: 46, id: "sda-46", title: "Holy, Holy, Holy" },
  }

  const verse: Verse = {
    id: 0,
    translation_id: 1,
    book_number: 43,
    book_name: "John",
    book_abbreviation: "",
    chapter: 3,
    verse: 16,
    text: "For God so loved the world.",
  }

  return {
    clearDetectionsMock: vi.fn(),
    detection,
    hymnDetection,
    detectionsRef: { current: [detection] as DetectionResult[] },
    presentVerseMock: vi.fn(),
    selectPreviewVerseMock: vi.fn(),
    presentHymnMock: vi.fn(),
    previewHymnMock: vi.fn(),
    queueHymnMock: vi.fn(),
    verse,
  }
})

vi.mock("@/hooks/use-detection", () => ({
  useDetection: () => ({ detections: detectionsRef.current }),
  detectionActions: {
    clearDetections: clearDetectionsMock,
    getDetectionStatus: vi.fn(async () => ({
      has_semantic: true,
      paraphrase_enabled: false,
    })),
  },
}))

vi.mock("@/lib/presentation-workflow", () => ({
  createEgwQueueItem: vi.fn(() => ({ id: "egw-queue-item" })),
  createScriptureQueueItem: vi.fn(() => ({ id: "queue-item" })),
  detectionToVerse: vi.fn(() => verse),
  presentVerse: (...args: unknown[]) => presentVerseMock(...args),
  presentEgwParagraph: vi.fn(),
  previewEgwParagraph: vi.fn(),
  selectPreviewVerse: (...args: unknown[]) => selectPreviewVerseMock(...args),
}))

vi.mock("@/services/hymnal/hymn-voice-control", () => ({
  presentHymnByNumber: (...args: unknown[]) => presentHymnMock(...args),
  previewHymnByNumber: (...args: unknown[]) => previewHymnMock(...args),
  queueHymnByNumber: (...args: unknown[]) => queueHymnMock(...args),
}))

vi.mock("@/stores/queue-store", () => ({
  useQueueStore: {
    getState: () => ({
      addOrFlashItem: vi.fn(),
    }),
  },
}))

describe("DetectionsPanel", () => {
  beforeEach(() => {
    detectionsRef.current = [detection]
    selectPreviewVerseMock.mockClear()
    presentVerseMock.mockClear()
    clearDetectionsMock.mockClear()
    presentHymnMock.mockClear()
    previewHymnMock.mockClear()
    queueHymnMock.mockClear()
    useSettingsStore.setState({ autoPreviewDetections: true })
  })

  afterEach(() => {
    cleanup()
  })

  it("previews a detection without navigating the Bible search panel", () => {
    render(<DetectionsPanel />)

    fireEvent.click(screen.getByRole("button", { name: /preview/i }))

    expect(selectPreviewVerseMock).toHaveBeenCalledWith(verse)
    expect(selectPreviewVerseMock).not.toHaveBeenCalledWith(
      verse,
      expect.objectContaining({ navigate: true })
    )
  })

  it("toggles automatic detection preview from the panel header", () => {
    render(<DetectionsPanel />)

    fireEvent.click(
      screen.getByRole("switch", { name: /auto preview detections/i })
    )

    expect(useSettingsStore.getState().autoPreviewDetections).toBe(false)
  })

  it("presents a detection without navigating the Bible search panel", () => {
    render(<DetectionsPanel />)

    fireEvent.click(screen.getByRole("button", { name: /present/i }))

    expect(presentVerseMock).toHaveBeenCalledWith(verse)
    expect(presentVerseMock).not.toHaveBeenCalledWith(
      verse,
      expect.objectContaining({ navigate: true })
    )
  })

  it("renders an Ellen White detection card in the box", () => {
    const egwDetection: DetectionResult = {
      content_type: "egw",
      verse_ref: "Steps to Christ 1:2",
      verse_text: "Nature and revelation alike testify of God's love.",
      book_name: "Steps to Christ",
      book_number: 2,
      chapter: 1,
      verse: 2,
      confidence: 0.94,
      source: "direct",
      auto_queued: false,
      transcript_snippet: "steps to christ chapter one paragraph two",
      is_chapter_only: false,
      egw_paragraph: {
        id: 1,
        book_number: 2,
        book_title: "Steps to Christ",
        chapter: 1,
        chapter_title: "God's Love for Man",
        paragraph: 2,
        text: "Nature and revelation alike testify of God's love.",
      },
    }
    detectionsRef.current = [egwDetection]
    render(<DetectionsPanel />)

    expect(screen.getByText("Steps to Christ 1:2")).toBeTruthy()
    expect(
      screen.getByText("Nature and revelation alike testify of God's love.")
    ).toBeTruthy()
  })

  it("renders a spoken hymn as a card and sends it live", async () => {
    detectionsRef.current = [hymnDetection]
    render(<DetectionsPanel />)

    expect(screen.getByText("Hymn 46")).toBeTruthy()
    expect(screen.getByText("Holy, Holy, Holy")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /present/i }))

    await waitFor(() => expect(presentHymnMock).toHaveBeenCalledWith(46))
    expect(presentVerseMock).not.toHaveBeenCalled()
  })
})
