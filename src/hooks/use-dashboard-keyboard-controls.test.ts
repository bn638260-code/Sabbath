// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { handleDashboardKeyboardEvent } from "./use-dashboard-keyboard-controls"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import type { HymnPresentationItemData } from "@/types"
import type { SlideDeckPresentationItemData } from "@/types"
import { useApiKeyPromptStore } from "@/lib/api-key-prompt"
import { useTranscriptStore } from "@/stores/transcript-store"

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

describe("handleDashboardKeyboardEvent", () => {
  beforeEach(() => {
    useHymnSlideStore.getState().setDeck([makeSlide(0), makeSlide(1), makeSlide(2)], 0)
    useSermonSlideStore.getState().setDeck(
      [makeSermonSlide(0), makeSermonSlide(1), makeSermonSlide(2)],
      0,
      "item-1",
    )
    useBroadcastStore.setState({
      isLive: false,
      previewItem: null,
      liveItem: null,
    })
  })

  it("advances a staged hymn preview with arrow keys", () => {
    previewFirstDeckSlide()

    handleDashboardKeyboardEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))

    expect(useHymnSlideStore.getState().activeIndex).toBe(1)
    expect(useBroadcastStore.getState().previewItem?.hymnSlide?.screenId).toBe("screen-1")
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

    handleDashboardKeyboardEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))

    expect(useHymnSlideStore.getState().activeIndex).toBe(1)
    expect(useBroadcastStore.getState().liveItem?.hymnSlide?.screenId).toBe("screen-1")
  })

  it("advances a staged sermon slide preview with arrow keys", () => {
    const deck = useSermonSlideStore.getState().deck
    useBroadcastStore.getState().setPreviewItem(deck[0])

    handleDashboardKeyboardEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))

    expect(useSermonSlideStore.getState().activeIndex).toBe(1)
    expect(useBroadcastStore.getState().previewItem?.reference).toBe(
      "Series - Slide 2 of 3",
    )
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

    handleDashboardKeyboardEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))

    expect(useSermonSlideStore.getState().activeIndex).toBe(1)
    expect(useBroadcastStore.getState().liveItem?.reference).toBe(
      "Series - Slide 2 of 3",
    )
  })

  it("ignores arrow keys from editable controls", () => {
    previewFirstDeckSlide()
    const input = document.createElement("input")
    const event = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    input.dispatchEvent(event)

    handleDashboardKeyboardEvent(event)

    expect(useHymnSlideStore.getState().activeIndex).toBe(0)
    expect(useBroadcastStore.getState().previewItem?.hymnSlide?.screenId).toBe("screen-0")
  })

  it("opens the API-key prompt when Ctrl+M cannot start Deepgram", async () => {
    invokeMock.mockRejectedValueOnce(new Error("No Deepgram API key configured"))

    handleDashboardKeyboardEvent(
      new KeyboardEvent("keydown", { key: "m", ctrlKey: true }),
    )

    await vi.waitFor(() => {
      expect(useApiKeyPromptStore.getState().isOpen).toBe(true)
    })
  })
})
