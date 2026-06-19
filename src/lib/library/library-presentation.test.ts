import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createQueueItemsForLibraryAsset,
  libraryAssetToFirstPresentation,
  queueLibraryAsset,
} from "./library-presentation"
import { useQueueStore } from "@/stores/queue-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import type { LibraryAsset } from "@/types/library"

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn().mockResolvedValue(undefined),
}))

function slideTemplateAsset(): LibraryAsset {
  return {
    id: "deck-1",
    name: "Emergency Deck",
    type: "slide-template",
    collectionIds: [],
    thumbnail: "data:image/png;base64,one",
    deck: [
      {
        kind: "slideDeck",
        deckId: "deck-1",
        deckTitle: "Emergency Deck",
        slideId: "deck-1-slide-1",
        slideIndex: 0,
        slideCount: 2,
        slidePath: "data:image/png;base64,one",
        reference: "Emergency Deck - Slide 1",
        segments: [{ text: "Slide 1" }],
      },
      {
        kind: "slideDeck",
        deckId: "deck-1",
        deckTitle: "Emergency Deck",
        slideId: "deck-1-slide-2",
        slideIndex: 1,
        slideCount: 2,
        slidePath: "data:image/png;base64,two",
        reference: "Emergency Deck - Slide 2",
        segments: [{ text: "Slide 2" }],
      },
    ],
    createdAt: 1,
    updatedAt: 1,
  }
}

describe("library presentation helpers", () => {
  beforeEach(() => {
    useQueueStore.getState().clearQueue()
    useSermonSlideStore.getState().clear()
  })

  it("turns a PowerPoint library asset into a first slide preview", () => {
    const first = libraryAssetToFirstPresentation(slideTemplateAsset())

    expect(first?.renderData).toMatchObject({
      kind: "slideDeck",
      reference: "Emergency Deck - Slide 1",
      slideImageUrl: "data:image/png;base64,one",
      hymnSlide: {
        slideIndex: 0,
        slideCount: 2,
      },
    })
  })

  it("creates one ordered queue item for each slide in a slide-template asset", () => {
    const items = createQueueItemsForLibraryAsset(slideTemplateAsset())

    expect(items).toHaveLength(2)
    expect(items.map((item) => item.presentation.reference)).toEqual([
      "Emergency Deck - Slide 1",
      "Emergency Deck - Slide 2",
    ])
    expect(items.every((item) => item.slideDeck?.length === 2)).toBe(true)
  })

  it("queues a slide-template asset and primes the sermon slide deck", () => {
    const queued = queueLibraryAsset(slideTemplateAsset())

    expect(queued).toBe(2)
    expect(useQueueStore.getState().items).toHaveLength(2)
    expect(useSermonSlideStore.getState()).toMatchObject({
      activeItemId: "deck-1",
      activeIndex: 0,
    })
  })
})
