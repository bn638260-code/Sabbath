import { create } from "zustand"
import {
  loadLibrarySnapshot,
  saveLibrarySnapshot,
} from "@/lib/library/library-persistence"
import {
  assignLibraryImportOrder,
  normalizeLibraryImportOrder,
  sortLibraryAssetsByImportOrder,
} from "@/lib/library/library-order"
import { deleteLibraryImage } from "@/lib/library/library-image"
import type { LibraryAsset, LibraryCollection } from "@/types/library"

interface LibraryState {
  assets: LibraryAsset[]
  collections: LibraryCollection[]
  hydrated: boolean
  hydrate: () => Promise<void>
  addAsset: (asset: LibraryAsset) => void
  updateAsset: (id: string, patch: Partial<LibraryAsset>) => void
  deleteAsset: (id: string) => void
  createCollection: (name: string) => LibraryCollection
  renameCollection: (id: string, name: string) => void
  deleteCollection: (id: string) => void
  addAssetToCollection: (assetId: string, collectionId: string) => void
  removeAssetFromCollection: (assetId: string, collectionId: string) => void
}

let hydrationPromise: Promise<void> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingSave = Promise.resolve()

function now(): number {
  return Date.now()
}

function persistSoon(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    const snapshot = {
      assets: useLibraryStore.getState().assets,
      collections: useLibraryStore.getState().collections,
    }
    pendingSave = pendingSave.then(() => saveLibrarySnapshot(snapshot))
  }, 250)
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  assets: [],
  collections: [],
  hydrated: false,

  hydrate: async () => {
    if (hydrationPromise) return hydrationPromise
    hydrationPromise = loadLibrarySnapshot()
      .then((snapshot) => {
        set({
          ...snapshot,
          assets: normalizeLibraryImportOrder(snapshot.assets),
          hydrated: true,
        })
      })
      .catch((error) => {
        console.warn("[library] failed to hydrate library", error)
        set({ hydrated: true })
        hydrationPromise = null
      })
    return hydrationPromise
  },

  addAsset: (asset) => {
    set((state) => {
      const assets = normalizeLibraryImportOrder(state.assets)
      return {
        assets: sortLibraryAssetsByImportOrder(
          assets.some((existing) => existing.id === asset.id)
            ? assets.map((existing) =>
                existing.id === asset.id
                  ? assignLibraryImportOrder(asset, assets, existing)
                  : existing,
              )
            : [assignLibraryImportOrder(asset, assets), ...assets],
        ),
      }
    })
    persistSoon()
  },

  updateAsset: (id, patch) => {
    set((state) => ({
      assets: state.assets.map((asset) =>
        asset.id === id
          ? ({ ...asset, ...patch, updatedAt: now() } as LibraryAsset)
          : asset,
      ),
    }))
    persistSoon()
  },

  deleteAsset: (id) => {
    const asset = get().assets.find((entry) => entry.id === id)
    set((state) => ({
      assets: state.assets.filter((entry) => entry.id !== id),
      collections: state.collections.map((collection) => ({
        ...collection,
        assetIds: collection.assetIds.filter((assetId) => assetId !== id),
        coverAssetId:
          collection.coverAssetId === id ? undefined : collection.coverAssetId,
        updatedAt: now(),
      })),
    }))
    if (asset?.type === "image") void deleteLibraryImage(asset.fileName)
    persistSoon()
  },

  createCollection: (name) => {
    const collection: LibraryCollection = {
      id: crypto.randomUUID(),
      name: name.trim() || "Untitled Collection",
      assetIds: [],
      createdAt: now(),
      updatedAt: now(),
    }
    set((state) => ({ collections: [collection, ...state.collections] }))
    persistSoon()
    return collection
  },

  renameCollection: (id, name) => {
    const nextName = name.trim()
    if (!nextName) return
    set((state) => ({
      collections: state.collections.map((collection) =>
        collection.id === id
          ? { ...collection, name: nextName, updatedAt: now() }
          : collection,
      ),
    }))
    persistSoon()
  },

  deleteCollection: (id) => {
    set((state) => ({
      collections: state.collections.filter((collection) => collection.id !== id),
      assets: state.assets.map((asset) =>
        asset.collectionIds.includes(id)
          ? {
              ...asset,
              collectionIds: asset.collectionIds.filter(
                (collectionId) => collectionId !== id,
              ),
              updatedAt: now(),
            }
          : asset,
      ),
    }))
    persistSoon()
  },

  addAssetToCollection: (assetId, collectionId) => {
    set((state) => ({
      assets: state.assets.map((asset) =>
        asset.id === assetId && !asset.collectionIds.includes(collectionId)
          ? {
              ...asset,
              collectionIds: [...asset.collectionIds, collectionId],
              updatedAt: now(),
            }
          : asset,
      ),
      collections: state.collections.map((collection) =>
        collection.id === collectionId && !collection.assetIds.includes(assetId)
          ? {
              ...collection,
              assetIds: [...collection.assetIds, assetId],
              coverAssetId: collection.coverAssetId ?? assetId,
              updatedAt: now(),
            }
          : collection,
      ),
    }))
    persistSoon()
  },

  removeAssetFromCollection: (assetId, collectionId) => {
    set((state) => ({
      assets: state.assets.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              collectionIds: asset.collectionIds.filter((id) => id !== collectionId),
              updatedAt: now(),
            }
          : asset,
      ),
      collections: state.collections.map((collection) =>
        collection.id === collectionId
          ? {
              ...collection,
              assetIds: collection.assetIds.filter((id) => id !== assetId),
              coverAssetId:
                collection.coverAssetId === assetId
                  ? collection.assetIds.find((id) => id !== assetId)
                  : collection.coverAssetId,
              updatedAt: now(),
            }
          : collection,
      ),
    }))
    persistSoon()
  },
}))

export function hydrateLibraryStore(): Promise<void> {
  return useLibraryStore.getState().hydrate()
}
