import { create } from "zustand"
import { presentLibraryAsset } from "@/lib/library/library-presentation"
import { useLibraryStore } from "@/stores/library-store"

const STORAGE_KEY = "sabbathcue:emergency-slide:asset-id"

interface EmergencySlideState {
  selectedAssetId: string
  setSelectedAssetId: (assetId: string) => void
  clearSelectedAsset: () => void
  presentEmergency: () => boolean
}

function readStoredAssetId(): string {
  try {
    return globalThis.localStorage.getItem(STORAGE_KEY) ?? ""
  } catch {
    return ""
  }
}

function saveStoredAssetId(assetId: string): void {
  try {
    if (assetId) {
      globalThis.localStorage.setItem(STORAGE_KEY, assetId)
    } else {
      globalThis.localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // localStorage is optional in tests and non-browser runtimes.
  }
}

export const useEmergencySlideStore = create<EmergencySlideState>((set, get) => ({
  selectedAssetId: readStoredAssetId(),
  setSelectedAssetId: (selectedAssetId) => {
    saveStoredAssetId(selectedAssetId)
    set({ selectedAssetId })
  },
  clearSelectedAsset: () => {
    saveStoredAssetId("")
    set({ selectedAssetId: "" })
  },
  presentEmergency: () => {
    const selectedAssetId = get().selectedAssetId
    if (!selectedAssetId) return false
    const asset = useLibraryStore
      .getState()
      .assets.find((candidate) => candidate.id === selectedAssetId)
    return asset ? presentLibraryAsset(asset) : false
  },
}))
