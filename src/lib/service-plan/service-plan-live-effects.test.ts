import { beforeEach, describe, expect, it, vi } from "vitest"

const selectPreviewItem = vi.fn()
const getHymnByNumber = vi.fn()
const generateHymnScreens = vi.fn()
const createHymnPresentationItem = vi.fn()
const loadActiveSermonSlideDeck = vi.fn()
const buildSermonSlideDeck = vi.fn()
const hymnSetDeck = vi.fn()
const sermonSetDeck = vi.fn()
const sermonClear = vi.fn()

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

vi.mock("@/services/slides/sermon-slide-voice-control", () => ({
  loadActiveSermonSlideDeck: (...args: unknown[]) =>
    loadActiveSermonSlideDeck(...args),
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
    expect(loadActiveSermonSlideDeck).toHaveBeenCalledWith(0)
    expect(selectPreviewItem).toHaveBeenCalledWith(slide)
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

    expect(sermonSetDeck).toHaveBeenCalledWith([slide], 0, "item-1")
    expect(selectPreviewItem).toHaveBeenCalledWith(slide)
    expect(getHymnByNumber).not.toHaveBeenCalled()
  })
})
