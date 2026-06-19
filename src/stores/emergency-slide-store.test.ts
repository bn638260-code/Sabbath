// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useLibraryStore } from "@/stores/library-store"
import type { LibraryAsset } from "@/types/library"

const { presentLibraryAssetMock } = vi.hoisted(() => ({
  presentLibraryAssetMock: vi.fn(),
}))

vi.mock("@/lib/library/library-presentation", () => ({
  presentLibraryAsset: (...args: unknown[]) => presentLibraryAssetMock(...args),
}))

function imageAsset(): LibraryAsset {
  return {
    id: "emergency-image",
    name: "Emergency Image",
    type: "image",
    collectionIds: [],
    fileName: "emergency.png",
    width: 1920,
    height: 1080,
    mimeType: "image/png",
    thumbnail: "data:image/png;base64,abc",
    createdAt: 1,
    updatedAt: 1,
  }
}

describe("emergency-slide-store", () => {
  beforeEach(async () => {
    localStorage.clear()
    presentLibraryAssetMock.mockReset()
    presentLibraryAssetMock.mockReturnValue(true)
    useLibraryStore.setState({ assets: [imageAsset()], collections: [] })
    const { useEmergencySlideStore } = await import("./emergency-slide-store")
    useEmergencySlideStore.setState({ selectedAssetId: "" })
  })

  it("stores the configured emergency asset id", async () => {
    const { useEmergencySlideStore } = await import("./emergency-slide-store")

    useEmergencySlideStore.getState().setSelectedAssetId("emergency-image")

    expect(useEmergencySlideStore.getState().selectedAssetId).toBe("emergency-image")
    expect(localStorage.getItem("sabbathcue:emergency-slide:asset-id")).toBe(
      "emergency-image"
    )
  })

  it("presents the configured emergency library asset", async () => {
    const { useEmergencySlideStore } = await import("./emergency-slide-store")
    useEmergencySlideStore.getState().setSelectedAssetId("emergency-image")

    expect(useEmergencySlideStore.getState().presentEmergency()).toBe(true)
    expect(presentLibraryAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "emergency-image" })
    )
  })

  it("does not present when the configured asset is missing", async () => {
    const { useEmergencySlideStore } = await import("./emergency-slide-store")
    useEmergencySlideStore.getState().setSelectedAssetId("missing")

    expect(useEmergencySlideStore.getState().presentEmergency()).toBe(false)
    expect(presentLibraryAssetMock).not.toHaveBeenCalled()
  })
})
