import { presentItem, selectPreviewItem } from "@/lib/presentation-workflow"
import { buildSermonSlideDeck } from "@/services/slides/sermon-slide-deck"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import type { ServiceItem } from "@/types/service-plan"

function activeServiceItem(): ServiceItem | null {
  const plan = useServicePlanStore.getState().activePlan
  if (!plan?.activeItemId) return null
  return plan.items.find((item) => item.id === plan.activeItemId) ?? null
}

function clampSlideIndex(index: number, deckLength: number): number {
  return Math.max(0, Math.min(deckLength - 1, index))
}

function setSermonSlideDeckForItem(
  item: ServiceItem,
  index: number,
): ReturnType<typeof buildSermonSlideDeck> | null {
  const deck = buildSermonSlideDeck(item)
  if (deck.length === 0) return null
  const clampedIndex = clampSlideIndex(index, deck.length)
  useSermonSlideStore.getState().setDeck(deck, clampedIndex, item.id)
  return deck
}

function isValidSlideIndex(index: number, deckLength: number): boolean {
  return index >= 0 && index < deckLength
}

export function loadSermonSlideDeckForItem(
  item: ServiceItem | null,
  index = 0,
): boolean {
  if (!item) {
    useSermonSlideStore.getState().clear()
    return false
  }
  return setSermonSlideDeckForItem(item, index) !== null
}

export function previewSermonSlideForItem(item: ServiceItem, index: number): boolean {
  const deck = buildSermonSlideDeck(item)
  if (deck.length === 0 || !isValidSlideIndex(index, deck.length)) return false
  useSermonSlideStore.getState().setDeck(deck, index, item.id)
  selectPreviewItem(deck[index])
  return true
}

export function presentSermonSlideForItem(item: ServiceItem, index: number): boolean {
  const deck = buildSermonSlideDeck(item)
  if (deck.length === 0 || !isValidSlideIndex(index, deck.length)) return false
  useSermonSlideStore.getState().setDeck(deck, index, item.id)
  presentItem(deck[index])
  return true
}

export function loadActiveSermonSlideDeck(index = 0): boolean {
  return loadSermonSlideDeckForItem(activeServiceItem(), index)
}

export function previewSermonSlideAt(index: number): boolean {
  const item = activeServiceItem()
  return item ? previewSermonSlideForItem(item, index) : false
}

export function presentSermonSlideAt(index: number): boolean {
  const item = activeServiceItem()
  return item ? presentSermonSlideForItem(item, index) : false
}
