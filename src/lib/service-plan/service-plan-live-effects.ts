import { buildServiceContext } from "@/lib/service-plan/service-context"
import { selectPreviewItem } from "@/lib/presentation-workflow"
import { generateHymnScreens } from "@/services/hymnal/generate-hymn-screens"
import {
  createHymnPresentationItem,
  defaultSelectedSectionIds,
} from "@/services/hymnal/hymn-presentation"
import { getHymnByNumber } from "@/services/hymnal/hymnal-repository"
import { buildSermonSlideDeck } from "@/services/slides/sermon-slide-deck"
import { loadActiveSermonSlideDeck } from "@/services/slides/sermon-slide-voice-control"
import { mediaPreloadManager } from "@/services/media/media-preload-manager"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import type { ServiceContext, ServiceItem, ServicePlan } from "@/types/service-plan"

export function syncServiceContext(plan: ServicePlan | null): ServiceContext {
  const context = buildServiceContext(plan)
  if (plan) {
    mediaPreloadManager.syncFromContext(context)
  } else {
    mediaPreloadManager.releaseAll()
  }
  return context
}

export function releaseCompletedItemMedia(item: ServiceItem | undefined): void {
  if (!item) return
  for (const attachment of item.attachments) {
    mediaPreloadManager.releaseCompletedItem(attachment.id)
  }
  for (const media of item.mediaRefs) {
    mediaPreloadManager.releaseCompletedItem(media.attachmentId)
  }
}

export function releaseAllServiceMedia(): void {
  mediaPreloadManager.releaseAll()
}

export async function loadHymnDeckForItem(item: ServiceItem): Promise<boolean> {
  for (const hymnRef of item.hymnRefs) {
    if (!hymnRef.hymnNumber) continue
    try {
      const hymn = await getHymnByNumber(hymnRef.hymnNumber)
      if (!hymn) continue
      const screens = generateHymnScreens({
        hymn,
        selectedSectionIds: defaultSelectedSectionIds(hymn),
      })
      if (screens.length === 0) continue
      const deck = screens.map((screen) => createHymnPresentationItem(screen))
      useHymnSlideStore.getState().setDeck(deck, 0)
      return true
    } catch {
      // Non-fatal when hymn data is unavailable.
    }
  }
  return false
}

export async function syncActiveServiceItemPresentations(
  item: ServiceItem | null,
): Promise<void> {
  if (!item) {
    useHymnSlideStore.getState().setDeck([], 0)
    useSermonSlideStore.getState().clear()
    return
  }

  const slideDeck = buildSermonSlideDeck(item)
  if (slideDeck.length > 0) {
    useHymnSlideStore.getState().setDeck([], 0)
    loadActiveSermonSlideDeck(0)
    selectPreviewItem(slideDeck[0])
    return
  }

  useSermonSlideStore.getState().clear()
  if (await loadHymnDeckForItem(item)) {
    const first = useHymnSlideStore.getState().deck[0]
    if (first) selectPreviewItem(first)
  }
}

export async function previewFirstContentForItem(item: ServiceItem): Promise<void> {
  const slideDeck = buildSermonSlideDeck(item)
  if (slideDeck.length > 0) {
    useSermonSlideStore.getState().setDeck(slideDeck, 0, item.id)
    selectPreviewItem(slideDeck[0])
    return
  }

  for (const hymnRef of item.hymnRefs) {
    if (!hymnRef.hymnNumber) continue
    try {
      const hymn = await getHymnByNumber(hymnRef.hymnNumber)
      if (!hymn) continue
      const screens = generateHymnScreens({
        hymn,
        selectedSectionIds: defaultSelectedSectionIds(hymn),
      })
      const first = screens[0]
      if (!first) continue
      selectPreviewItem(createHymnPresentationItem(first))
      return
    } catch {
      // Practice preview failure is non-fatal.
    }
  }
}
