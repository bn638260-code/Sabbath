import { beforeEach, describe, expect, it, vi } from "vitest"
import type { EgwParagraph, HymnPresentationItemData, Verse } from "@/types"

const emitToMock = vi.fn()

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: emitToMock,
}))

const sampleVerse: Verse = {
  id: 1,
  translation_id: 1,
  book_number: 43,
  book_name: "John",
  book_abbreviation: "John",
  chapter: 3,
  verse: 16,
  text: "For God so loved the world.",
}

const sampleHymnItem: HymnPresentationItemData = {
  kind: "hymn",
  hymnId: "hymn-001",
  hymnNumber: 1,
  hymnTitle: "Praise to the Lord",
  screenId: "screen-1",
  slideIndex: 0,
  slideCount: 2,
  reference: "#1 Praise to the Lord - Verse 1",
  segments: [{ text: "Praise to the Lord, the Almighty" }],
}

const sampleEgwParagraph: EgwParagraph = {
  id: 7,
  book_number: 1,
  book_title: "Patriarchs and Prophets",
  chapter: 2,
  chapter_title: "The Creation",
  paragraph: 5,
  text: "God is love.",
}

function expectBroadcastOutputsFor(reference: string) {
  expect(emitToMock).toHaveBeenCalledWith(
    "broadcast",
    "broadcast:verse-update",
    expect.objectContaining({
      item: expect.objectContaining({ reference }),
    }),
  )
  expect(emitToMock).toHaveBeenCalledWith(
    "broadcast-alt",
    "broadcast:verse-update",
    expect.objectContaining({
      item: expect.objectContaining({ reference }),
    }),
  )
}

describe("presentation workflow", () => {
  beforeEach(async () => {
    emitToMock.mockReset()
    emitToMock.mockResolvedValue(undefined)
    vi.resetModules()
  })

  it("selectPreviewVerse only updates the Bible preview", async () => {
    const { useBibleStore } = await import("@/stores/bible-store")
    const { selectPreviewVerse } = await import("./presentation-workflow")

    selectPreviewVerse(sampleVerse)

    expect(useBibleStore.getState().selectedVerse).toMatchObject({
      book_name: "John",
      chapter: 3,
      verse: 16,
    })
    expect(emitToMock).not.toHaveBeenCalled()
  })

  it("commitPreviewToLive sends the selected verse live", async () => {
    const { useBibleStore } = await import("@/stores/bible-store")
    const { useBroadcastStore } = await import("@/stores/broadcast-store")
    const { toVerseRenderData } = await import("@/hooks/use-broadcast")
    const { commitPreviewToLive } = await import("./presentation-workflow")

    useBibleStore.setState({
      selectedVerse: sampleVerse,
      translations: [
        {
          id: 1,
          abbreviation: "KJV",
          title: "King James Version",
          language: "en",
          is_copyrighted: false,
          is_downloaded: true,
        },
      ],
      activeTranslationId: 1,
    })

    const committed = commitPreviewToLive()
    const previewPayload = toVerseRenderData(sampleVerse, "KJV")

    expect(committed).toBe(true)
    expect(useBroadcastStore.getState().isLive).toBe(true)
    expect(useBroadcastStore.getState().liveItem).toEqual(previewPayload)
    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast",
      "broadcast:verse-update",
      expect.objectContaining({
        item: previewPayload,
      }),
    )
    expectBroadcastOutputsFor("John 3:16 (KJV)")
  })

  it("commitPreviewToLive returns false when no verse is staged", async () => {
    const { useBibleStore } = await import("@/stores/bible-store")
    const { commitPreviewToLive } = await import("./presentation-workflow")

    useBibleStore.setState({ selectedVerse: null })

    expect(commitPreviewToLive()).toBe(false)
  })

  it("commitPreviewToLive broadcasts a staged non-scripture item", async () => {
    const { useBroadcastStore } = await import("@/stores/broadcast-store")
    const { commitPreviewToLive, selectPreviewItem } = await import("./presentation-workflow")

    selectPreviewItem(sampleHymnItem)
    emitToMock.mockClear()

    expect(commitPreviewToLive()).toBe(true)
    expect(useBroadcastStore.getState().isLive).toBe(true)
    expect(useBroadcastStore.getState().liveItem).toEqual(
      useBroadcastStore.getState().previewItem,
    )
    expectBroadcastOutputsFor("#1 Praise to the Lord - Verse 1")
  })

  it("auto-live commits the verse before staging preview", async () => {
    const { useBibleStore } = await import("@/stores/bible-store")
    const { useBroadcastStore } = await import("@/stores/broadcast-store")
    const { toVerseRenderData } = await import("@/hooks/use-broadcast")
    const { previewVerseAndMaybeAutoLive } = await import("./presentation-workflow")

    useBibleStore.setState({
      selectedVerse: null,
      translations: [
        {
          id: 1,
          abbreviation: "KJV",
          title: "King James Version",
          language: "en",
          is_copyrighted: false,
          is_downloaded: true,
        },
      ],
      activeTranslationId: 1,
    })
    useBroadcastStore.setState({
      isLive: true,
      readingModeAutoLive: true,
      liveItem: null,
    })

    const previewSelections: Array<Verse | null> = []
    const unsubscribe = useBibleStore.subscribe((state) => {
      previewSelections.push(state.selectedVerse)
      expect(useBroadcastStore.getState().liveItem).toEqual(
        toVerseRenderData(sampleVerse, "KJV")
      )
    })

    previewVerseAndMaybeAutoLive(sampleVerse, {
      autoLive: true,
    })
    unsubscribe()

    expect(previewSelections).toHaveLength(1)
    expect(useBibleStore.getState().selectedVerse).toEqual(sampleVerse)
    expectBroadcastOutputsFor("John 3:16 (KJV)")
  })

  it("auto-live turns the live output on when it was not already live", async () => {
    const { useBibleStore } = await import("@/stores/bible-store")
    const { useBroadcastStore } = await import("@/stores/broadcast-store")
    const { previewVerseAndMaybeAutoLive } = await import("./presentation-workflow")

    useBibleStore.setState({
      selectedVerse: null,
      translations: [
        {
          id: 1,
          abbreviation: "KJV",
          title: "King James Version",
          language: "en",
          is_copyrighted: false,
          is_downloaded: true,
        },
      ],
      activeTranslationId: 1,
    })
    useBroadcastStore.setState({
      isLive: false,
      readingModeAutoLive: true,
      liveItem: null,
    })

    previewVerseAndMaybeAutoLive(sampleVerse, { autoLive: true })

    expect(useBroadcastStore.getState().isLive).toBe(true)
    expect(useBibleStore.getState().selectedVerse).toEqual(sampleVerse)
  })

  it("commitVerseToLive can refresh the live item without changing live visibility", async () => {
    const { useBroadcastStore } = await import("@/stores/broadcast-store")
    const { commitVerseToLive } = await import("./presentation-workflow")

    useBroadcastStore.setState({
      isLive: true,
      liveItem: {
        reference: "Romans 8:1 (KJV)",
        segments: [{ verseNumber: 1, text: "There is therefore now no condemnation." }],
      },
    })

    emitToMock.mockClear()
    commitVerseToLive(sampleVerse, { makeLive: false })

    expect(useBroadcastStore.getState().isLive).toBe(true)
    expect(useBroadcastStore.getState().liveItem?.reference).toBe("John 3:16 (KJV)")
    expectBroadcastOutputsFor("John 3:16 (KJV)")
  })

  it("presentVerse stages preview and broadcasts to both outputs", async () => {
    const { useBibleStore } = await import("@/stores/bible-store")
    const { useBroadcastStore } = await import("@/stores/broadcast-store")
    const { presentVerse } = await import("./presentation-workflow")

    emitToMock.mockClear()
    presentVerse(sampleVerse)

    expect(useBibleStore.getState().selectedVerse).toEqual(sampleVerse)
    expect(useBroadcastStore.getState().previewItem?.reference).toBe("John 3:16 (KJV)")
    expect(useBroadcastStore.getState().liveItem?.reference).toBe("John 3:16 (KJV)")
    expect(useBroadcastStore.getState().isLive).toBe(true)
    expectBroadcastOutputsFor("John 3:16 (KJV)")
  })

  it("presentItem broadcasts non-scripture presentation data to both outputs", async () => {
    const { useBroadcastStore } = await import("@/stores/broadcast-store")
    const { presentItem } = await import("./presentation-workflow")

    emitToMock.mockClear()
    presentItem(sampleHymnItem)

    expect(useBroadcastStore.getState().previewItem).toMatchObject({
      kind: "hymn",
      reference: "#1 Praise to the Lord - Verse 1",
      hymnSlide: {
        screenId: "screen-1",
        slideIndex: 0,
        slideCount: 2,
      },
    })
    expect(useBroadcastStore.getState().liveItem).toEqual(
      useBroadcastStore.getState().previewItem,
    )
    expectBroadcastOutputsFor("#1 Praise to the Lord - Verse 1")
  })

  it("presentEgwParagraph broadcasts EGW presentation data to both outputs", async () => {
    const { useBroadcastStore } = await import("@/stores/broadcast-store")
    const { presentEgwParagraph } = await import("./presentation-workflow")

    emitToMock.mockClear()
    presentEgwParagraph(sampleEgwParagraph)

    expect(useBroadcastStore.getState().liveItem).toMatchObject({
      kind: "egw",
      reference: "Patriarchs and Prophets 2:5",
      segments: [{ text: "God is love." }],
    })
    expectBroadcastOutputsFor("Patriarchs and Prophets 2:5")
  })
})
