// @vitest-environment jsdom
import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QueueWorkspace } from "./QueueWorkspace"
import { BUILTIN_THEMES } from "@/lib/builtin-themes"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useEmergencySlideStore } from "@/stores/emergency-slide-store"
import { useLibraryStore } from "@/stores/library-store"
import { useQueueStore } from "@/stores/queue-store"
import type { LibraryAsset } from "@/types/library"
import type { QueueItem } from "@/types"

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/components/ui/canvas-verse", () => ({
  CanvasPresentation: () =>
    React.createElement("div", { "data-testid": "canvas-presentation" }),
}))

function queuedSlide(): QueueItem {
  return {
    id: "queued-slide-1",
    presentation: {
      kind: "slideDeck",
      deckId: "deck-1",
      deckTitle: "Sermon",
      slideId: "slide-1",
      slideIndex: 1,
      slideCount: 3,
      slidePath: "data:image/png;base64,slide",
      reference: "Sermon - Slide 2",
      segments: [{ text: "Slide 2" }],
    },
    confidence: 1,
    source: "manual",
    added_at: 1,
  }
}

function imageAsset(): LibraryAsset {
  return {
    id: "asset-1",
    name: "Emergency Image",
    type: "image",
    collectionIds: [],
    fileName: "emergency.png",
    width: 1920,
    height: 1080,
    mimeType: "image/png",
    thumbnail: "data:image/png;base64,asset",
    createdAt: 1,
    updatedAt: 1,
  }
}

describe("QueueWorkspace", () => {
  beforeEach(() => {
    useBroadcastStore.setState({
      themes: [...BUILTIN_THEMES],
      activeThemeId: BUILTIN_THEMES[0].id,
    })
    useQueueStore.setState({
      items: [queuedSlide()],
      activeIndex: 0,
      highlightedId: null,
      highlightedIds: [],
    })
    useLibraryStore.setState({ assets: [imageAsset()], collections: [] })
    useEmergencySlideStore.setState({ selectedAssetId: "" })
  })

  afterEach(() => {
    cleanup()
  })

  it("renders queued items with order and slide numbering", () => {
    render(<QueueWorkspace />)

    expect(screen.getByText("01")).toBeTruthy()
    expect(screen.getByText("Slide 2/3")).toBeTruthy()
    expect(screen.getByText("Sermon - Slide 2")).toBeTruthy()
  })

  it("edits the configured emergency slide asset", () => {
    render(<QueueWorkspace />)

    fireEvent.change(screen.getByLabelText("Emergency slide asset"), {
      target: { value: "asset-1" },
    })

    expect(useEmergencySlideStore.getState().selectedAssetId).toBe("asset-1")
  })
})
