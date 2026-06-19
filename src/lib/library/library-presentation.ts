import { getPresentationRenderData } from "@/types"
import type {
  HymnPresentationItemData,
  PresentationItem,
  PresentationRenderData,
  QueueItem,
  SlideDeckPresentationItemData,
} from "@/types"
import { videoAssetToPresentation } from "@/lib/library/library-video"
import { songDocToDeck } from "@/lib/library/song-doc"
import { presentItem, selectPreviewItem } from "@/lib/presentation-workflow"
import { createHymnDeckQueueItems } from "@/services/hymnal/hymn-presentation"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useQueueStore } from "@/stores/queue-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import type { LibraryAsset } from "@/types/library"

export interface LibraryPresentation {
  presentation: PresentationItem
  renderData: PresentationRenderData
  hymnDeck?: HymnPresentationItemData[]
  slideDeck?: SlideDeckPresentationItemData[]
}

export function isPresentableLibraryAsset(asset: LibraryAsset): boolean {
  return asset.type !== "theme"
}

function imagePresentation(asset: Extract<LibraryAsset, { type: "image" }>) {
  const presentation: SlideDeckPresentationItemData = {
    kind: "slideDeck",
    deckId: asset.id,
    deckTitle: asset.name,
    slideId: asset.id,
    slideIndex: 0,
    slideCount: 1,
    slidePath: asset.thumbnail ?? asset.fileName,
    reference: asset.name,
    segments: [{ text: asset.name }],
  }
  return {
    presentation,
    renderData: getPresentationRenderData(presentation),
    slideDeck: [presentation],
  }
}

export function libraryAssetToFirstPresentation(
  asset: LibraryAsset
): LibraryPresentation | null {
  if (asset.type === "theme") return null

  if (asset.type === "image") {
    return imagePresentation(asset)
  }

  if (asset.type === "song") {
    const hymnDeck = songDocToDeck(asset.song)
    const first = hymnDeck[0]
    if (!first) return null
    return {
      presentation: first,
      renderData: getPresentationRenderData(first),
      hymnDeck,
    }
  }

  if (asset.type === "slide-template") {
    const first = asset.deck[0]
    if (!first) return null
    return {
      presentation: first,
      renderData: getPresentationRenderData(first),
      slideDeck: asset.deck,
    }
  }

  if (asset.type === "video") {
    const presentation = videoAssetToPresentation(asset)
    return {
      presentation,
      renderData: getPresentationRenderData(presentation),
    }
  }

  return null
}

function prepareDeckStores(presentation: LibraryPresentation): void {
  if (presentation.hymnDeck?.length) {
    const activeIndex = presentation.hymnDeck.findIndex(
      (slide) =>
        presentation.presentation.kind === "hymn" &&
        slide.screenId === presentation.presentation.screenId
    )
    useHymnSlideStore.getState().setDeck(
      presentation.hymnDeck,
      activeIndex >= 0 ? activeIndex : 0
    )
  }

  if (
    presentation.presentation.kind === "slideDeck" &&
    presentation.slideDeck?.length
  ) {
    const item = presentation.presentation
    const activeIndex = presentation.slideDeck.findIndex(
      (slide) => slide.slideId === item.slideId
    )
    useSermonSlideStore.getState().setDeck(
      presentation.slideDeck,
      activeIndex >= 0 ? activeIndex : item.slideIndex,
      item.deckId
    )
  }
}

export function previewLibraryAsset(asset: LibraryAsset): boolean {
  const presentation = libraryAssetToFirstPresentation(asset)
  if (!presentation) return false
  prepareDeckStores(presentation)
  selectPreviewItem(presentation.presentation)
  return true
}

export function presentLibraryAsset(asset: LibraryAsset): boolean {
  const presentation = libraryAssetToFirstPresentation(asset)
  if (!presentation) return false
  prepareDeckStores(presentation)
  presentItem(presentation.presentation)
  return true
}

export function createQueueItemsForLibraryAsset(asset: LibraryAsset): QueueItem[] {
  if (asset.type === "song") {
    const deck = songDocToDeck(asset.song)
    if (deck.length === 0) return []
    return createHymnDeckQueueItems(deck, {
      groupId: `library-song-${asset.id}-${crypto.randomUUID()}`,
      groupLabel: `${asset.name} - ${deck.length} slides`,
      source: "manual",
      idPrefix: `library-song-${asset.id}`,
    })
  }

  if (asset.type === "slide-template") {
    return asset.deck.map((slide) => ({
      id: crypto.randomUUID(),
      presentation: slide,
      confidence: 1,
      source: "manual",
      added_at: Date.now(),
      slideDeck: asset.deck,
    }))
  }

  const presentation = libraryAssetToFirstPresentation(asset)
  if (!presentation) return []
  return [
    {
      id: crypto.randomUUID(),
      presentation: presentation.presentation,
      confidence: 1,
      source: "manual",
      added_at: Date.now(),
      slideDeck: presentation.slideDeck,
    },
  ]
}

export function queueLibraryAsset(asset: LibraryAsset): number {
  const items = createQueueItemsForLibraryAsset(asset)
  if (items.length === 0) return 0

  const first = libraryAssetToFirstPresentation(asset)
  if (first) prepareDeckStores(first)
  useQueueStore.getState().addItems(items)
  return items.length
}
