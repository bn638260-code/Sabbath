// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/queue-presentation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/queue-presentation")>()
  return {
    ...actual,
    presentQueuedItem: vi.fn(),
    presentQueuedItemAtEnd: vi.fn(),
  }
})

import { PresentationDeckControls } from "./presentation-deck-controls"
import {
  presentQueuedItem,
  presentQueuedItemAtEnd,
} from "@/lib/queue-presentation"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useQueueStore } from "@/stores/queue-store"
import { getPresentationRenderData } from "@/types"
import type { HymnPresentationItemData, QueueItem } from "@/types"

function makeHymnSlide(index: number): HymnPresentationItemData {
  return {
    kind: "hymn",
    hymnId: "hymn-12",
    hymnNumber: 12,
    hymnTitle: "Joyful",
    screenId: `screen-${index}`,
    slideIndex: index,
    slideCount: 3,
    reference: `Joyful - Slide ${index + 1} of 3`,
    segments: [{ text: `Line ${index + 1}` }],
  }
}

function hymnQueueItem(id: string): QueueItem {
  return {
    id,
    presentation: makeHymnSlide(0),
    confidence: 1,
    source: "manual",
    added_at: Date.now(),
  }
}

const hymnItemA = hymnQueueItem("hymn-a")
const hymnItemB = hymnQueueItem("hymn-b")
const deck = [makeHymnSlide(0), makeHymnSlide(1), makeHymnSlide(2)]

describe("PresentationDeckControls queue-boundary crossing", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    localStorage.clear()
    useQueueStore.getState().clearQueue()
    useHymnSlideStore.getState().setDeck([], 0)
    vi.mocked(presentQueuedItem).mockClear()
    vi.mocked(presentQueuedItemAtEnd).mockClear()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(slideIndex: number, crossQueueBoundaries: boolean) {
    const item = getPresentationRenderData(deck[slideIndex]!)
    act(() => {
      root.render(
        <PresentationDeckControls
          item={item}
          onNavigate={() => {}}
          crossQueueBoundaries={crossQueueBoundaries}
        />
      )
    })
  }

  function button(title: string): HTMLButtonElement {
    const el = container.querySelector<HTMLButtonElement>(`[title="${title}"]`)
    if (!el) throw new Error(`button ${title} not found`)
    return el
  }

  it("crosses into the next queue item past the last slide", () => {
    useQueueStore.getState().addItems([hymnItemA, hymnItemB])
    useQueueStore.getState().setActive(0)
    useHymnSlideStore.getState().setDeck(deck, deck.length - 1)
    render(deck.length - 1, true)

    const next = button("Next hymn slide")
    expect(next.disabled).toBe(false)
    act(() => next.click())

    expect(vi.mocked(presentQueuedItem).mock.calls[0][0].id).toBe(hymnItemB.id)
    expect(useQueueStore.getState().activeIndex).toBe(1)
  })

  it("goes back to the previous queue item's last slide from the first slide", () => {
    useQueueStore.getState().addItems([hymnItemA, hymnItemB])
    useQueueStore.getState().setActive(1)
    useHymnSlideStore.getState().setDeck(deck, 0)
    render(0, true)

    const prev = button("Previous hymn slide")
    expect(prev.disabled).toBe(false)
    act(() => prev.click())

    expect(vi.mocked(presentQueuedItemAtEnd).mock.calls[0][0].id).toBe(
      hymnItemA.id
    )
    expect(useQueueStore.getState().activeIndex).toBe(0)
  })

  it("disables next at the deck end when the queue has no next item", () => {
    useQueueStore.getState().addItems([hymnItemA])
    useQueueStore.getState().setActive(0)
    useHymnSlideStore.getState().setDeck(deck, deck.length - 1)
    render(deck.length - 1, true)

    expect(button("Next hymn slide").disabled).toBe(true)
  })

  it("stays clamped at the boundary without crossQueueBoundaries", () => {
    useQueueStore.getState().addItems([hymnItemA, hymnItemB])
    useQueueStore.getState().setActive(0)
    useHymnSlideStore.getState().setDeck(deck, deck.length - 1)
    render(deck.length - 1, false)

    expect(button("Next hymn slide").disabled).toBe(true)
  })
})
