import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useQueueStore } from "@/stores/queue-store"
import type {
  HymnPresentationItemData,
  PresentationRenderData,
  QueueItem,
} from "@/types"

function findHymnDeckIndex(
  deck: HymnPresentationItemData[],
  item: HymnPresentationItemData
): number {
  const screenIndex = deck.findIndex(
    (slide) => slide.screenId === item.screenId
  )
  if (screenIndex >= 0) return screenIndex

  const slideIndex = deck.findIndex(
    (slide) => slide.slideIndex === item.slideIndex
  )
  return slideIndex >= 0 ? slideIndex : 0
}

function findHymnDeckIndexForRenderItem(
  deck: HymnPresentationItemData[],
  item: PresentationRenderData
): number {
  const screenId = item.hymnSlide?.screenId
  if (screenId) {
    const screenIndex = deck.findIndex((slide) => slide.screenId === screenId)
    if (screenIndex >= 0) return screenIndex
  }

  const slideIndex = item.hymnSlide?.slideIndex
  if (slideIndex !== undefined) {
    const index = deck.findIndex((slide) => slide.slideIndex === slideIndex)
    if (index >= 0) return index
  }

  return 0
}

export function restoreHymnDeckForQueueItem(item: QueueItem): boolean {
  if (item.presentation.kind !== "hymn" || !item.hymnDeck?.length) return false

  useHymnSlideStore
    .getState()
    .setDeck(item.hymnDeck, findHymnDeckIndex(item.hymnDeck, item.presentation))
  return true
}

export function getQueuedHymnDeckForRenderItem(
  item: PresentationRenderData | null
): HymnPresentationItemData[] | null {
  if (item?.kind !== "hymn" || !item.hymnSlide?.screenId) return null

  const queue = useQueueStore.getState()
  const activeQueueItem =
    queue.activeIndex === null ? null : (queue.items[queue.activeIndex] ?? null)
  if (
    activeQueueItem?.presentation.kind !== "hymn" ||
    !activeQueueItem.hymnDeck?.length
  ) {
    return null
  }

  const screenId = item.hymnSlide.screenId
  return activeQueueItem.hymnDeck.some((slide) => slide.screenId === screenId)
    ? activeQueueItem.hymnDeck
    : null
}

export function restoreQueuedHymnDeckForRenderItem(
  item: PresentationRenderData | null
): boolean {
  const deck = getQueuedHymnDeckForRenderItem(item)
  if (!deck || !item) return false

  useHymnSlideStore
    .getState()
    .setDeck(deck, findHymnDeckIndexForRenderItem(deck, item))
  return true
}
