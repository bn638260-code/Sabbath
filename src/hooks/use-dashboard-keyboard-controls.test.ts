// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { handleDashboardKeyboardEvent } from "./use-dashboard-keyboard-controls"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useEgwSlideStore } from "@/stores/egw-slide-store"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import type { EgwPresentationItemData, HymnPresentationItemData } from "@/types"
import type { SlideDeckPresentationItemData } from "@/types"
import { useApiKeyPromptStore } from "@/lib/api-key-prompt"
import { useTranscriptStore } from "@/stores/transcript-store"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import { useQueueStore } from "@/stores/queue-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { useTutorialStore } from "@/stores/tutorial-store"
import { useBibleStore } from "@/stores/bible-store"
import { useEgwStore } from "@/stores/egw-store"
import type { EgwParagraph, QueueItem, Verse } from "@/types"

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}))

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}))

function makeSlide(index: number): HymnPresentationItemData {
  return {
    kind: "hymn",
    hymnId: "hymn-12",
    hymnNumber: 12,
    hymnTitle: "Joyful",
    screenId: `screen-${index}`,
    slideIndex: index,
    slideCount: 3,
    reference: `Joyful - Slide ${index + 1} of 3`,
    segments: [{ text: `Line ${index + 1}` }],
  }
}

function makeVerse(verse: number): Verse {
  return {
    id: verse,
    translation_id: 1,
    book_number: 1,
    book_name: "Genesis",
    book_abbreviation: "Gen",
    chapter: 1,
    verse,
    text: `Verse ${verse} text.`,
  }
}

function makeEgwParagraph(paragraph: number): EgwParagraph {
  return {
    id: paragraph,
    book_number: 1,
    book_title: "Test Book",
    chapter: 1,
    chapter_title: "Chapter",
    paragraph,
    text: `Sample paragraph ${paragraph} text.`,
  }
}

function makeEgwSlide(
  index: number,
  paragraph = makeEgwParagraph(1)
): EgwPresentationItemData {
  return {
    kind: "egw",
    paragraph,
    reference: `Test Book 1:${paragraph.paragraph} (${index + 1}/2)`,
    slideId: `egw-${paragraph.id}-${index}`,
    slideIndex: index,
    slideCount: 2,
    segments: [{ text: paragraph.text }],
  }
}

function makeSermonSlide(index: number): SlideDeckPresentationItemData {
  return {
    kind: "slideDeck",
    deckId: "deck-12",
    deckTitle: "Series",
    slideId: `slide-${index}`,
    slideIndex: index,
    slideCount: 3,
    slidePath: `/slides/${index}.png`,
    reference: `Series - Slide ${index + 1} of 3`,
    segments: [{ text: `Caption ${index + 1}` }],
  }
}

function previewFirstDeckSlide() {
  const deck = useHymnSlideStore.getState().deck
  useBroadcastStore.getState().setPreviewItem({
    kind: "hymn",
    reference: deck[0].reference,
    segments: deck[0].segments,
    hymnSlide: {
      screenId: deck[0].screenId,
      slideIndex: deck[0].slideIndex,
      slideCount: deck[0].slideCount,
    },
  })
}

function makeQueueItem(id: string, index: number): QueueItem {
  return {
    id,
    confidence: 1,
    source: "manual",
    added_at: index,
    presentation: makeSlide(index),
  }
}

function makeQueuedHymnDeckItem(index: number): QueueItem {
  const deck = [makeSlide(0), makeSlide(1), makeSlide(2)]
  return {
    ...makeQueueItem(`queued-${index}`, index),
    source: "hymn",
    hymnGroup: {
      groupId: "queued-hymn",
      groupLabel: "Joyful - 3 screens",
      itemIndex: index + 1,
      itemCount: deck.length,
    },
    hymnDeck: deck,
  }
}

describe("handleDashboardKeyboardEvent", () => {
  beforeEach(() => {
    useHymnSlideStore
      .getState()
      .setDeck([makeSlide(0), makeSlide(1), makeSlide(2)], 0)
    useSermonSlideStore
      .getState()
      .setDeck(
        [makeSermonSlide(0), makeSermonSlide(1), makeSermonSlide(2)],
        0,
        "item-1"
      )
    useEgwSlideStore.getState().setDeck([makeEgwSlide(0), makeEgwSlide(1)], 0)
    useBroadcastStore.setState({
      isLive: false,
      previewItem: null,
      liveItem: null,
    })
    useQueueStore.setState({
      items: [],
      activeIndex: null,
      highlightedId: null,
      highlightedIds: [],
    })
    useDashboardWorkspaceStore.setState({ workspace: "live" })
    useServicePlanStore.setState({ plannerOpen: false })
    useTutorialStore.setState({ isRunning: false })
    useBibleStore.getState().selectVerse(null)
    useBibleStore.getState().setCurrentChapter([])
    useEgwStore.setState({ currentParagraphs: [] })
    useTranscriptStore.setState({ isTranscribing: false })
  })

  it("uses Ctrl+number shortcuts to switch workspaces", () => {
    useServicePlanStore.setState({ plannerOpen: true })

    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", { key: "3", ctrlKey: true })
    )

    expect(useDashboardWorkspaceStore.getState().workspace).toBe("run-service")
    expect(useServicePlanStore.getState().plannerOpen).toBe(false)

    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", { key: "2", ctrlKey: true })
    )

    expect(useDashboardWorkspaceStore.getState().workspace).toBe(
      "service-plans"
    )
    expect(useServicePlanStore.getState().plannerOpen).toBe(true)
  })

  it("keeps legacy Alt+number workspace shortcuts working", () => {
    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", { key: "4", altKey: true })
    )

    expect(useDashboardWorkspaceStore.getState().workspace).toBe("hymns")
  })

  it("opens the Library workspace with Ctrl+5", () => {
    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", { key: "5", ctrlKey: true })
    )

    expect(useDashboardWorkspaceStore.getState().workspace).toBe("library")
  })

  it("suspends dashboard shortcuts while the tutorial is running", () => {
    useTutorialStore.setState({ isRunning: true })

    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", { key: "3", ctrlKey: true })
    )

    expect(useDashboardWorkspaceStore.getState().workspace).toBe("live")
  })

  it("blackouts live output with Ctrl+Shift+B", () => {
    useBroadcastStore.setState({
      isLive: true,
      liveItem: {
        kind: "hymn",
        reference: "Joyful - Slide 1 of 3",
        segments: [{ text: "Line 1" }],
      },
    })

    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", { key: "b", ctrlKey: true, shiftKey: true })
    )

    expect(useBroadcastStore.getState().isLive).toBe(false)
    expect(useBroadcastStore.getState().liveItem).toBeNull()
  })

  it("sends the preview live with Ctrl+Enter", () => {
    useBroadcastStore.getState().setPreviewItem({
      kind: "hymn",
      reference: "Joyful - Slide 1 of 3",
      segments: [{ text: "Line 1" }],
    })

    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true })
    )

    expect(useBroadcastStore.getState().isLive).toBe(true)
    expect(useBroadcastStore.getState().liveItem?.reference).toBe(
      "Joyful - Slide 1 of 3"
    )
  })

  it("selects queued items with Alt+ArrowDown", () => {
    useQueueStore.setState({
      items: [makeQueueItem("first", 0), makeQueueItem("second", 1)],
      activeIndex: null,
    })

    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true })
    )

    expect(useQueueStore.getState().activeIndex).toBe(0)
    expect(useBroadcastStore.getState().previewItem?.reference).toBe(
      "Joyful - Slide 1 of 3"
    )
  })

  it("presents the active queued item with Ctrl+Shift+Enter", () => {
    useQueueStore.setState({
      items: [makeQueueItem("first", 0)],
      activeIndex: 0,
    })

    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        ctrlKey: true,
        shiftKey: true,
      })
    )

    expect(useBroadcastStore.getState().isLive).toBe(true)
    expect(useBroadcastStore.getState().liveItem?.reference).toBe(
      "Joyful - Slide 1 of 3"
    )
  })

  it("restores an older queued hymn deck before presenting and advancing it", () => {
    const otherDeck = [
      {
        ...makeSlide(0),
        hymnId: "hymn-99",
        screenId: "other-screen-0",
        reference: "Other Hymn - Slide 1 of 1",
      },
    ]
    useHymnSlideStore.getState().setDeck(otherDeck, 0)
    useQueueStore.setState({
      items: [makeQueuedHymnDeckItem(1)],
      activeIndex: 0,
    })

    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        ctrlKey: true,
        shiftKey: true,
      })
    )

    expect(
      useHymnSlideStore.getState().deck.map((slide) => slide.screenId)
    ).toEqual(["screen-0", "screen-1", "screen-2"])
    expect(useHymnSlideStore.getState().activeIndex).toBe(1)
    expect(useBroadcastStore.getState().liveItem?.hymnSlide?.screenId).toBe(
      "screen-1"
    )

    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight" })
    )

    expect(useBroadcastStore.getState().liveItem?.hymnSlide?.screenId).toBe(
      "screen-2"
    )
  })

  it("advances a staged hymn preview with arrow keys", () => {
    previewFirstDeckSlide()

    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight" })
    )

    expect(useHymnSlideStore.getState().activeIndex).toBe(1)
    expect(useBroadcastStore.getState().previewItem?.hymnSlide?.screenId).toBe(
      "screen-1"
    )
  })

  it("advances a live hymn with arrow keys", () => {
    const deck = useHymnSlideStore.getState().deck
    useBroadcastStore.setState({
      isLive: true,
      liveItem: {
        kind: "hymn",
        reference: deck[0].reference,
        segments: deck[0].segments,
        hymnSlide: {
          screenId: deck[0].screenId,
          slideIndex: deck[0].slideIndex,
          slideCount: deck[0].slideCount,
        },
      },
    })

    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight" })
    )

    expect(useHymnSlideStore.getState().activeIndex).toBe(1)
    expect(useBroadcastStore.getState().liveItem?.hymnSlide?.screenId).toBe(
      "screen-1"
    )
  })

  it("advances a staged scripture preview with arrow keys", async () => {
    const verses = [makeVerse(1), makeVerse(2), makeVerse(3)]
    useBibleStore.getState().setCurrentChapter(verses)
    useBroadcastStore.getState().setPreviewItem({
      kind: "scripture",
      reference: "Genesis 1:1",
      scripture: verses[0],
      segments: [{ verseNumber: 1, text: verses[0].text }],
    })

    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight" })
    )

    // Scripture navigation is serialized on a promise chain, so it resolves
    // asynchronously.
    await vi.waitFor(() => {
      expect(useBroadcastStore.getState().previewItem?.scripture?.verse).toBe(2)
      expect(useBibleStore.getState().selectedVerse?.verse).toBe(2)
    })
  })

  it("advances a live scripture verse with arrow keys", async () => {
    const verses = [makeVerse(1), makeVerse(2), makeVerse(3)]
    useBibleStore.getState().setCurrentChapter(verses)
    useBroadcastStore.setState({
      isLive: true,
      liveItem: {
        kind: "scripture",
        reference: "Genesis 1:2",
        scripture: verses[1],
        segments: [{ verseNumber: 2, text: verses[1].text }],
      },
    })

    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft" })
    )

    await vi.waitFor(() => {
      expect(useBroadcastStore.getState().liveItem?.scripture?.verse).toBe(1)
      expect(useBibleStore.getState().selectedVerse?.verse).toBe(1)
    })
  })

  it("advances a staged sermon slide preview with arrow keys", () => {
    const deck = useSermonSlideStore.getState().deck
    useBroadcastStore.getState().setPreviewItem(deck[0])

    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight" })
    )

    expect(useSermonSlideStore.getState().activeIndex).toBe(1)
    expect(useBroadcastStore.getState().previewItem?.reference).toBe(
      "Series - Slide 2 of 3"
    )
  })

  it("advances a staged EGW slide preview with arrow keys", () => {
    const deck = useEgwSlideStore.getState().deck
    useBroadcastStore.getState().setPreviewItem({
      kind: "egw",
      reference: deck[0].reference,
      segments: deck[0].segments,
      hymnSlide: {
        screenId: deck[0].slideId,
        slideIndex: deck[0].slideIndex,
        slideCount: deck[0].slideCount,
      },
    })

    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight" })
    )

    expect(useEgwSlideStore.getState().activeIndex).toBe(1)
    expect(useBroadcastStore.getState().previewItem?.hymnSlide?.screenId).toBe(
      "egw-1-1"
    )
  })

  it("advances to the next EGW paragraph after the final paragraph slide", async () => {
    const first = makeEgwParagraph(1)
    const second = makeEgwParagraph(2)
    const deck = [makeEgwSlide(0, first), makeEgwSlide(1, first)]
    useEgwStore.setState({ currentParagraphs: [first, second] })
    useEgwSlideStore.getState().setDeck(deck, 1)
    useBroadcastStore.getState().setPreviewItem({
      kind: "egw",
      reference: deck[1].reference,
      segments: deck[1].segments,
      egwParagraph: first,
      hymnSlide: {
        screenId: deck[1].slideId,
        slideIndex: deck[1].slideIndex,
        slideCount: deck[1].slideCount,
      },
    })

    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight" })
    )

    // Paragraph-to-paragraph EGW navigation is serialized on a promise chain.
    await vi.waitFor(() => {
      expect(useEgwSlideStore.getState().activeIndex).toBe(0)
      expect(
        useBroadcastStore.getState().previewItem?.egwParagraph?.paragraph
      ).toBe(2)
    })
  })

  it("advances a live sermon slide with arrow keys", () => {
    const deck = useSermonSlideStore.getState().deck
    useBroadcastStore.setState({
      isLive: true,
      liveItem: deck[0],
    })
    useTranscriptStore.setState({ isTranscribing: false })
    useApiKeyPromptStore.setState({ isOpen: false })
    invokeMock.mockReset()

    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight" })
    )

    expect(useSermonSlideStore.getState().activeIndex).toBe(1)
    expect(useBroadcastStore.getState().liveItem?.reference).toBe(
      "Series - Slide 2 of 3"
    )
  })

  it("ignores arrow keys from editable controls", () => {
    previewFirstDeckSlide()
    const input = document.createElement("input")
    const event = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
    })
    input.dispatchEvent(event)

    handleDashboardKeyboardEvent(event)

    expect(useHymnSlideStore.getState().activeIndex).toBe(0)
    expect(useBroadcastStore.getState().previewItem?.hymnSlide?.screenId).toBe(
      "screen-0"
    )
  })

  it("opens the API-key prompt when Ctrl+M cannot start Deepgram", async () => {
    invokeMock.mockRejectedValueOnce(
      new Error("No Deepgram API key configured")
    )

    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", { key: "m", ctrlKey: true })
    )

    await vi.waitFor(() => {
      expect(useApiKeyPromptStore.getState().isOpen).toBe(true)
    })
  })
})
