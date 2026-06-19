import { restoreHymnDeckForQueueItem } from "@/lib/queued-hymn-deck"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import type { QueueItem } from "@/types"

export function restorePresentationDeckForQueueItem(item: QueueItem): boolean {
  if (restoreHymnDeckForQueueItem(item)) return true

  const presentation = item.presentation
  if (presentation.kind !== "slideDeck" || !item.slideDeck?.length) {
    return false
  }

  const activeIndex = item.slideDeck.findIndex(
    (slide) => slide.slideId === presentation.slideId
  )
  useSermonSlideStore.getState().setDeck(
    item.slideDeck,
    activeIndex >= 0 ? activeIndex : presentation.slideIndex,
    presentation.deckId
  )
  return true
}
