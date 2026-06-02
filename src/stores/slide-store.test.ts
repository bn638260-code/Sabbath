import { describe, expect, it } from "vitest"
import { useHymnSlideStore } from "./hymn-slide-store"
import { useSermonSlideStore } from "./sermon-slide-store"

describe("slide stores", () => {
  it("normalizes invalid hymn slide indexes", () => {
    useHymnSlideStore.getState().setDeck([], Number.NaN)

    expect(useHymnSlideStore.getState().activeIndex).toBe(0)
  })

  it("normalizes invalid sermon slide indexes", () => {
    useSermonSlideStore.getState().setDeck([], Number.NaN, null)

    expect(useSermonSlideStore.getState().activeIndex).toBe(0)
  })
})
