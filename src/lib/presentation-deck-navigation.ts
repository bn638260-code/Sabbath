import type { HymnPresentationItemData, SlideDeckPresentationItemData } from "@/types"
import type { PresentationRenderData } from "@/types"

export type PresentationDeckKind = "hymn" | "slideDeck"

export interface PresentationDeckSlide {
  slideId: string
  slideIndex: number
  slideCount: number
  reference: string
}

export function hymnDeckSlides(
  deck: HymnPresentationItemData[],
): PresentationDeckSlide[] {
  return deck.map((slide) => ({
    slideId: slide.screenId,
    slideIndex: slide.slideIndex,
    slideCount: slide.slideCount,
    reference: slide.reference,
  }))
}

export function sermonDeckSlides(
  deck: SlideDeckPresentationItemData[],
): PresentationDeckSlide[] {
  return deck.map((slide) => ({
    slideId: slide.slideId,
    slideIndex: slide.slideIndex,
    slideCount: slide.slideCount,
    reference: slide.reference,
  }))
}

export function presentationDeckKind(
  item: PresentationRenderData | null,
): PresentationDeckKind | null {
  if (item?.kind === "hymn" || item?.kind === "slideDeck") return item.kind
  return null
}

export function presentationDeckSlideId(
  item: PresentationRenderData | null,
): string | null {
  if (!item?.hymnSlide?.screenId) return null
  return item.hymnSlide.screenId
}

export function findDeckIndex(
  deck: PresentationDeckSlide[],
  slideId: string | null | undefined,
  fallbackIndex: number,
): number {
  if (!slideId) return fallbackIndex
  const index = deck.findIndex((slide) => slide.slideId === slideId)
  return index >= 0 ? index : fallbackIndex
}

export function clampDeckIndex(
  deckLength: number,
  index: number,
  delta: number,
): number {
  if (deckLength === 0) return 0
  return Math.max(0, Math.min(deckLength - 1, index + delta))
}

export function canNavigateDeck(
  deckLength: number,
  index: number,
  delta: number,
): boolean {
  const next = clampDeckIndex(deckLength, index, delta)
  return next !== index
}
