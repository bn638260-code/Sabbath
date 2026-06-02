import { describe, expect, it } from "vitest"
import {
  canNavigateDeck,
  clampDeckIndex,
  findDeckIndex,
  hymnDeckSlides,
  presentationDeckKind,
  presentationDeckSlideId,
  sermonDeckSlides,
} from "./presentation-deck-navigation"
import type { HymnPresentationItemData, SlideDeckPresentationItemData } from "@/types"

function hymnSlide(index: number): HymnPresentationItemData {
  return {
    kind: "hymn",
    hymnId: "h1",
    hymnNumber: 1,
    hymnTitle: "Test",
    screenId: `screen-${index}`,
    slideIndex: index,
    slideCount: 3,
    reference: `Slide ${index + 1}`,
    segments: [{ text: "line" }],
  }
}

function sermonSlide(index: number): SlideDeckPresentationItemData {
  return {
    kind: "slideDeck",
    deckId: "deck-1",
    deckTitle: "Sermon",
    slideId: `slide-${index}`,
    slideIndex: index,
    slideCount: 2,
    slidePath: `/slides/${index}.png`,
    reference: `Sermon ${index + 1}`,
    segments: [{ text: "caption" }],
  }
}

describe("presentation deck navigation", () => {
  it("maps hymn and sermon decks to a shared slide shape", () => {
    expect(hymnDeckSlides([hymnSlide(0), hymnSlide(1)])).toEqual([
      expect.objectContaining({ slideId: "screen-0", slideIndex: 0 }),
      expect.objectContaining({ slideId: "screen-1", slideIndex: 1 }),
    ])
    expect(sermonDeckSlides([sermonSlide(0)])).toEqual([
      expect.objectContaining({ slideId: "slide-0", slideIndex: 0 }),
    ])
  })

  it("detects deck-backed preview items", () => {
    expect(
      presentationDeckKind({
        kind: "slideDeck",
        reference: "Sermon 1",
        segments: [],
        hymnSlide: { screenId: "slide-0", slideIndex: 0, slideCount: 2 },
      }),
    ).toBe("slideDeck")
    expect(presentationDeckSlideId({
      kind: "hymn",
      reference: "Hymn",
      segments: [],
      hymnSlide: { screenId: "screen-1", slideIndex: 1, slideCount: 3 },
    })).toBe("screen-1")
  })

  it("clamps next and previous indices", () => {
    const deck = hymnDeckSlides([hymnSlide(0), hymnSlide(1), hymnSlide(2)])
    const index = findDeckIndex(deck, "screen-1", 0)
    expect(clampDeckIndex(deck.length, index, 1)).toBe(2)
    expect(canNavigateDeck(deck.length, index, -1)).toBe(true)
    expect(canNavigateDeck(deck.length, 0, -1)).toBe(false)
  })
})
