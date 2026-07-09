// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { BUILTIN_THEMES } from "@/lib/builtin-themes"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useLibraryStore } from "@/stores/library-store"
import { useQueueStore } from "@/stores/queue-store"
import type { LibraryAsset } from "@/types/library"
import { AssetCard } from "./AssetCard"

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/library/library-persistence", () => ({
  loadLibrarySnapshot: vi
    .fn()
    .mockResolvedValue({ assets: [], collections: [] }),
  saveLibrarySnapshot: vi.fn().mockResolvedValue(undefined),
}))

function imageAsset(): LibraryAsset {
  return {
    id: "image-1",
    name: "Welcome Background",
    type: "image",
    collectionIds: [],
    fileName: "welcome.png",
    width: 1920,
    height: 1080,
    mimeType: "image/png",
    thumbnail: "data:image/png;base64,abc",
    importOrder: 1,
    createdAt: 1,
    updatedAt: 1,
  }
}

function videoAsset(): LibraryAsset {
  return {
    id: "video-1",
    name: "Welcome Video",
    type: "video",
    source: "url",
    collectionIds: [],
    url: "https://cdn.example.com/welcome.mp4",
    mimeType: "video/mp4",
    thumbnail: "data:image/jpeg;base64,abc",
    createdAt: 1,
    updatedAt: 1,
  }
}

function songAsset(): LibraryAsset {
  return {
    id: "song-1",
    name: "Opening Song",
    type: "song",
    collectionIds: [],
    song: {
      title: "Opening Song",
      sections: [
        {
          kind: "verse",
          index: 1,
          lines: ["Line one", "Line two", "Line three", "Line four"],
        },
      ],
    },
    createdAt: 1,
    updatedAt: 1,
  }
}

describe("AssetCard", () => {
  beforeEach(() => {
    useBroadcastStore.setState({
      activeThemeId: BUILTIN_THEMES[0].id,
      previewItem: null,
      themes: [...BUILTIN_THEMES],
    })
    useQueueStore.setState({ items: [], activeIndex: null })
    useHymnSlideStore.getState().setDeck([], 0)
    useLibraryStore.setState({
      assets: [imageAsset()],
      collections: [
        {
          id: "collection-1",
          name: "Easter",
          assetIds: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    })
  })

  afterEach(() => {
    cleanup()
  })

  it("previews and queues image assets as slide deck items", () => {
    render(<AssetCard asset={imageAsset()} />)

    expect(screen.getByText("#001")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /preview/i }))
    expect(useBroadcastStore.getState().previewItem).toMatchObject({
      kind: "slideDeck",
      reference: "Welcome Background",
      slideImageUrl: "data:image/png;base64,abc",
    })

    fireEvent.click(screen.getByRole("button", { name: /queue/i }))
    expect(useQueueStore.getState().items[0].presentation).toMatchObject({
      kind: "slideDeck",
      reference: "Welcome Background",
    })
  })

  it("previews and queues video assets as video items", () => {
    render(<AssetCard asset={videoAsset()} />)

    fireEvent.click(screen.getByRole("button", { name: /preview/i }))
    expect(useBroadcastStore.getState().previewItem).toMatchObject({
      kind: "video",
      reference: "Welcome Video",
      video: {
        source: "url",
        url: "https://cdn.example.com/welcome.mp4",
      },
    })

    fireEvent.click(screen.getByRole("button", { name: /queue/i }))
    expect(useQueueStore.getState().items[0].presentation).toMatchObject({
      kind: "video",
      reference: "Welcome Video",
      url: "https://cdn.example.com/welcome.mp4",
    })
  })

  it("queues every slide for multi-slide song assets", () => {
    render(<AssetCard asset={songAsset()} />)

    fireEvent.click(screen.getByRole("button", { name: /queue/i }))

    const items = useQueueStore.getState().items
    expect(items).toHaveLength(2)
    expect(items[0].presentation).toMatchObject({
      kind: "hymn",
      reference: "Opening Song - Verse 1 1/2",
    })
    expect(items[1].presentation).toMatchObject({
      kind: "hymn",
      reference: "Opening Song - Verse 1 2/2",
    })
    expect(items[0].hymnGroup?.groupId).toBe(items[1].hymnGroup?.groupId)
    expect(items[0].hymnDeck).toHaveLength(2)
    expect(useHymnSlideStore.getState().deck).toHaveLength(2)
  })

  it("adds an asset to the first unlinked collection", () => {
    render(<AssetCard asset={imageAsset()} />)

    fireEvent.click(screen.getByTitle("Add to Easter"))

    expect(useLibraryStore.getState().assets[0].collectionIds).toEqual([
      "collection-1",
    ])
    expect(useLibraryStore.getState().collections[0].assetIds).toEqual([
      "image-1",
    ])
  })

  it("applies a saved theme asset through the broadcast store", () => {
    const theme = {
      ...BUILTIN_THEMES[0],
      id: "library-theme",
      name: "Library Theme",
      builtin: false,
    }
    const asset: LibraryAsset = {
      id: "theme-asset",
      name: "Library Theme",
      type: "theme",
      collectionIds: [],
      theme,
      createdAt: 1,
      updatedAt: 1,
    }

    render(<AssetCard asset={asset} />)
    fireEvent.click(screen.getByRole("button", { name: /apply/i }))

    expect(useBroadcastStore.getState().activeThemeId).toBe("library-theme")
    expect(
      useBroadcastStore
        .getState()
        .themes.some((item) => item.id === "library-theme")
    ).toBe(true)
  })
})
