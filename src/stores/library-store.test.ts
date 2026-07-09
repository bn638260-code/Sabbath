import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { LibraryAsset, LibraryCollection } from "@/types/library"

const loadLibrarySnapshot = vi.fn()
const saveLibrarySnapshot = vi.fn()
const deleteLibraryImage = vi.fn()

vi.mock("@/lib/library/library-persistence", () => ({
  loadLibrarySnapshot: () => loadLibrarySnapshot(),
  saveLibrarySnapshot: (snapshot: unknown) => saveLibrarySnapshot(snapshot),
}))

vi.mock("@/lib/library/library-image", () => ({
  deleteLibraryImage: (fileName: string) => deleteLibraryImage(fileName),
}))

const { useLibraryStore } = await import("./library-store")

function imageAsset(id = "image-1", createdAt = 1): LibraryAsset {
  return {
    id,
    name: "Image",
    type: "image",
    collectionIds: [],
    fileName: `${id}.png`,
    width: 100,
    height: 100,
    mimeType: "image/png",
    createdAt,
    updatedAt: createdAt,
  }
}

function collection(id = "collection-1"): LibraryCollection {
  return {
    id,
    name: "Collection",
    assetIds: [],
    createdAt: 1,
    updatedAt: 1,
  }
}

async function flushPersistence() {
  await vi.advanceTimersByTimeAsync(300)
}

describe("library store", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    vi.clearAllMocks()
    loadLibrarySnapshot.mockResolvedValue({ assets: [], collections: [] })
    saveLibrarySnapshot.mockResolvedValue(undefined)
    useLibraryStore.setState({
      assets: [],
      collections: [],
      hydrated: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("creates, updates, and deletes assets", async () => {
    const asset = imageAsset()
    useLibraryStore.getState().addAsset(asset)
    expect(useLibraryStore.getState().assets).toEqual([
      { ...asset, importOrder: 1 },
    ])

    useLibraryStore.getState().updateAsset(asset.id, { name: "Updated" })
    expect(useLibraryStore.getState().assets[0]).toMatchObject({
      id: asset.id,
      name: "Updated",
      updatedAt: 1_000,
    })

    useLibraryStore.getState().deleteAsset(asset.id)
    expect(useLibraryStore.getState().assets).toEqual([])
    expect(deleteLibraryImage).toHaveBeenCalledWith("image-1.png")
    await flushPersistence()
    expect(saveLibrarySnapshot).toHaveBeenCalled()
  })

  it("assigns stable import numbers and keeps assets in import order", () => {
    const first = imageAsset("first")
    const second = imageAsset("second")

    useLibraryStore.getState().addAsset(first)
    useLibraryStore.getState().addAsset(second)

    expect(
      useLibraryStore.getState().assets.map((asset) => [asset.id, asset.importOrder])
    ).toEqual([
      ["first", 1],
      ["second", 2],
    ])

    useLibraryStore.getState().addAsset({ ...first, name: "Updated first" })

    expect(
      useLibraryStore.getState().assets.map((asset) => [asset.id, asset.importOrder])
    ).toEqual([
      ["first", 1],
      ["second", 2],
    ])
  })

  it("creates, renames, and deletes collections", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000001",
    )

    const created = useLibraryStore.getState().createCollection("  Easter  ")
    expect(created).toMatchObject({
      id: "00000000-0000-4000-8000-000000000001",
      name: "Easter",
    })

    useLibraryStore.getState().renameCollection(created.id, "Palm Sabbath")
    expect(useLibraryStore.getState().collections[0].name).toBe("Palm Sabbath")

    useLibraryStore.getState().deleteCollection(created.id)
    expect(useLibraryStore.getState().collections).toEqual([])
  })

  it("adds and removes asset membership from a collection", () => {
    const asset = imageAsset()
    const group = collection()
    useLibraryStore.setState({
      assets: [asset],
      collections: [group],
    })

    useLibraryStore.getState().addAssetToCollection(asset.id, group.id)
    expect(useLibraryStore.getState().assets[0].collectionIds).toEqual([group.id])
    expect(useLibraryStore.getState().collections[0].assetIds).toEqual([asset.id])
    expect(useLibraryStore.getState().collections[0].coverAssetId).toBe(asset.id)

    useLibraryStore.getState().removeAssetFromCollection(asset.id, group.id)
    expect(useLibraryStore.getState().assets[0].collectionIds).toEqual([])
    expect(useLibraryStore.getState().collections[0].assetIds).toEqual([])
  })

  it("hydrates from persistence", async () => {
    const snapshot = {
      assets: [imageAsset("newer", 2), imageAsset("older", 1)],
      collections: [collection()],
    }
    loadLibrarySnapshot.mockResolvedValue(snapshot)

    await useLibraryStore.getState().hydrate()

    expect(useLibraryStore.getState()).toMatchObject({
      assets: [
        { ...snapshot.assets[1], importOrder: 1 },
        { ...snapshot.assets[0], importOrder: 2 },
      ],
      collections: snapshot.collections,
      hydrated: true,
    })
  })
})
