import { beforeEach, describe, expect, it, vi } from "vitest"

const selectPreviewItem = vi.fn()
const getHymnByNumber = vi.fn()
const generateHymnScreens = vi.fn()
const createHymnPresentationItem = vi.fn()
const previewSermonSlideForItem = vi.fn()
const buildSermonSlideDeck = vi.fn()
const hymnSetDeck = vi.fn()
const sermonSetDeck = vi.fn()
const sermonClear = vi.fn()
let sermonActiveIndex = 0
let sermonActiveItemId: string | null = null

vi.mock("@/lib/presentation-workflow", () => ({
  selectPreviewItem: (...args: unknown[]) => selectPreviewItem(...args),
}))

vi.mock("@/services/hymnal/hymnal-repository", () => ({
  getHymnByNumber: (...args: unknown[]) => getHymnByNumber(...args),
}))

vi.mock("@/services/hymnal/generate-hymn-screens", () => ({
  generateHymnScreens: (...args: unknown[]) => generateHymnScreens(...args),
}))

vi.mock("@/services/hymnal/hymn-presentation", () => ({
  defaultSelectedSectionIds: () => ["verse-1"],
  createHymnPresentationItem: (...args: unknown[]) =>
    createHymnPresentationItem(...args),
}))

vi.mock("@/services/slides/sermon-slide-deck", () => ({
  buildSermonSlideDeck: (...args: unknown[]) => buildSermonSlideDeck(...args),
}))

vi.mock("@/services/slides/sermon-slide-live", () => ({
  previewSermonSlideForItem: (...args: unknown[]) =>
    previewSermonSlideForItem(...args),
}))

vi.mock("@/stores/hymn-slide-store", () => ({
  useHymnSlideStore: {
    getState: () => ({
      deck: [{ id: "hymn-preview" }],
      setDeck: hymnSetDeck,
    }),
  },
}))

vi.mock("@/stores/sermon-slide-store", () => ({
  useSermonSlideStore: {
    getState: () => ({
      activeIndex: sermonActiveIndex,
      activeItemId: sermonActiveItemId,
      setDeck: sermonSetDeck,
      clear: sermonClear,
    }),
  },
}))

vi.mock("@/services/media/media-preload-manager", () => ({
  mediaPreloadManager: {
    syncFromContext: vi.fn(),
    releaseAll: vi.fn(),
    releaseCompletedItem: vi.fn(),
  },
}))

describe("service plan live effects", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sermonActiveIndex = 0
    sermonActiveItemId = null
  })

  it("clears both hymn and sermon slide state when the active item is removed", async () => {
    const { syncActiveServiceItemPresentations } = await import("./service-plan-live-effects")

    await syncActiveServiceItemPresentations(null)

    expect(hymnSetDeck).toHaveBeenCalledWith([], 0)
    expect(sermonClear).toHaveBeenCalled()
  })

  it("clears stale hymn state and stages sermon slides when slide content becomes active", async () => {
    const slide = { id: "slide-1", reference: "Slide 1" }
    buildSermonSlideDeck.mockReturnValue([slide])
    const { syncActiveServiceItemPresentations } = await import("./service-plan-live-effects")

    await syncActiveServiceItemPresentations({
      id: "item-1",
      order: 0,
      title: "Slides",
      kind: "slide",
      status: "active",
      scriptureRefs: [],
      hymnRefs: [],
      mediaRefs: [],
      attachments: [],
      checklist: [],
    })

    expect(hymnSetDeck).toHaveBeenCalledWith([], 0)
    expect(previewSermonSlideForItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: "item-1" }),
      0,
    )
  })

  it("preserves the active sermon slide index when the same slide item resyncs", async () => {
    const slides = [
      { id: "slide-1", reference: "Slide 1" },
      { id: "slide-2", reference: "Slide 2" },
    ]
    sermonActiveIndex = 1
    sermonActiveItemId = "item-1"
    buildSermonSlideDeck.mockReturnValue(slides)
    const { syncActiveServiceItemPresentations } = await import("./service-plan-live-effects")

    await syncActiveServiceItemPresentations({
      id: "item-1",
      order: 0,
      title: "Slides",
      kind: "slide",
      status: "active",
      scriptureRefs: [],
      hymnRefs: [],
      mediaRefs: [],
      attachments: [],
      checklist: [],
    })

    expect(previewSermonSlideForItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: "item-1" }),
      1,
    )
  })

  it("stages the first sermon slide for practice preview before falling back to hymns", async () => {
    const slide = { id: "slide-1", reference: "Slide 1" }
    buildSermonSlideDeck.mockReturnValue([slide])
    const { previewFirstContentForItem } = await import("./service-plan-live-effects")

    await previewFirstContentForItem({
      id: "item-1",
      order: 0,
      title: "Slides",
      kind: "slide",
      status: "active",
      scriptureRefs: [],
      hymnRefs: [],
      mediaRefs: [],
      attachments: [],
      checklist: [],
    })

    expect(previewSermonSlideForItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: "item-1" }),
      0,
    )
    expect(getHymnByNumber).not.toHaveBeenCalled()
  })
})
