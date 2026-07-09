import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createQueueItemsForLibraryAssets,
  createQueueItemsForLibraryAsset,
  libraryAssetToFirstPresentation,
  queueLibraryAssetsInImportOrder,
  queueLibraryAsset,
} from "./library-presentation"
import { useQueueStore } from "@/stores/queue-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import type { LibraryAsset, LibrarySlideTemplateAsset } from "@/types/library"

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn().mockResolvedValue(undefined),
}))

function slideTemplateAsset(): LibrarySlideTemplateAsset {
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

function imageAsset(id: string, name: string, importOrder: number): LibraryAsset {
  return {
    id,
    name,
    type: "image",
    collectionIds: [],
    fileName: `${id}.png`,
    width: 1920,
    height: 1080,
    mimeType: "image/png",
    thumbnail: `data:image/png;base64,${id}`,
    importOrder,
    createdAt: importOrder,
    updatedAt: importOrder,
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

  it("defaults imported slides to no theme and injects applyTheme when enabled", () => {
    const off = libraryAssetToFirstPresentation(slideTemplateAsset())
    expect(off?.renderData.applyTheme).toBeUndefined()
    expect(off?.slideDeck?.every((slide) => !slide.applyTheme)).toBe(true)

    const themed = libraryAssetToFirstPresentation({
      ...slideTemplateAsset(),
      applyTheme: true,
    })
    expect(themed?.renderData.applyTheme).toBe(true)
    expect(themed?.slideDeck?.every((slide) => slide.applyTheme === true)).toBe(
      true
    )
  })

  it("uses extracted slide text when applying theme to a library PowerPoint deck", () => {
    const asset = slideTemplateAsset()
    asset.applyTheme = true
    asset.deck[0] = {
      ...asset.deck[0],
      extractedTextLines: ["Theme title", "First point"],
    }

    const themed = libraryAssetToFirstPresentation(asset)

    expect(themed?.renderData).toMatchObject({
      reference: "Theme title",
      slideImageUrl: "",
      segments: [{ text: "First point" }],
      applyTheme: true,
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

  it("creates and queues bulk library items in import order", () => {
    const assets = [
      imageAsset("third", "Third", 3),
      imageAsset("first", "First", 1),
      imageAsset("second", "Second", 2),
    ]

    expect(
      createQueueItemsForLibraryAssets(assets).map(
        (item) => item.presentation.reference
      )
    ).toEqual(["First", "Second", "Third"])

    expect(queueLibraryAssetsInImportOrder(assets)).toBe(3)
    expect(
      useQueueStore.getState().items.map((item) => item.presentation.reference)
    ).toEqual(["First", "Second", "Third"])
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
