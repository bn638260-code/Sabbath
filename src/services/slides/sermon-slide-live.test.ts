import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  loadActiveSermonSlideDeck,
  previewSermonSlideAt,
  previewSermonSlideForItem,
  presentSermonSlideAt,
} from "./sermon-slide-live"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { syncServiceContext } from "@/lib/service-plan/service-plan-live-effects"
import type { ServicePlan } from "@/types"

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn().mockResolvedValue(undefined),
}))

function plan(): ServicePlan {
  return {
    id: "plan-1",
    title: "Sabbath Service",
    status: "live",
    mode: "performance",
    createdAt: 1,
    updatedAt: 1,
    activeItemId: "item-1",
    eventLog: [],
    items: [
      {
        id: "item-1",
        order: 0,
        title: "Sermon",
        kind: "slide",
        status: "active",
        scriptureRefs: [],
        hymnRefs: [],
        mediaRefs: [],
        checklist: [],
        attachments: [
          {
            id: "slide-1",
            kind: "slide",
            label: "Opening",
            status: "ready",
            thumbnailUrl: "data:image/png;base64,one",
            order: 0,
          },
          {
            id: "slide-2",
            kind: "slide",
            label: "Appeal",
            status: "ready",
            thumbnailUrl: "data:image/png;base64,two",
            order: 1,
          },
        ],
      },
    ],
  }
}

describe("sermon slide live actions", () => {
  beforeEach(() => {
    const activePlan = plan()
    useServicePlanStore.setState({
      activePlan,
      serviceContext: syncServiceContext(activePlan),
    })
    useSermonSlideStore.getState().clear()
    useBroadcastStore.setState({ isLive: false, liveItem: null, previewItem: null })
  })

  it("loads the active deck at the requested index", () => {
    expect(loadActiveSermonSlideDeck(1)).toBe(true)
    expect(useSermonSlideStore.getState().activeIndex).toBe(1)
    expect(useSermonSlideStore.getState().deck).toHaveLength(2)
  })

  it("previews the requested slide without going live", () => {
    expect(previewSermonSlideAt(0)).toBe(true)
    expect(useSermonSlideStore.getState().activeIndex).toBe(0)
    expect(useBroadcastStore.getState().isLive).toBe(false)
    expect(useBroadcastStore.getState().previewItem?.reference).toBe(
      "Sermon - Opening",
    )
  })

  it("presents the requested slide live", () => {
    expect(presentSermonSlideAt(1)).toBe(true)
    expect(useSermonSlideStore.getState().activeIndex).toBe(1)
    expect(useBroadcastStore.getState().isLive).toBe(true)
    expect(useBroadcastStore.getState().liveItem?.reference).toBe("Sermon - Appeal")
  })

  it("rejects out-of-range indices", () => {
    expect(presentSermonSlideAt(9)).toBe(false)
    expect(previewSermonSlideAt(-1)).toBe(false)
    expect(useBroadcastStore.getState().liveItem).toBeNull()
  })

  it("preserves index when reloading within range", () => {
    loadActiveSermonSlideDeck(1)
    expect(loadActiveSermonSlideDeck(1)).toBe(true)
    expect(useSermonSlideStore.getState().activeIndex).toBe(1)
  })

  it("previews slides for an explicit item without relying on store active id", () => {
    useServicePlanStore.setState({
      activePlan: { ...plan(), activeItemId: null },
      serviceContext: syncServiceContext(plan()),
    })

    const item = plan().items[0]
    expect(previewSermonSlideForItem(item, 1)).toBe(true)
    expect(useSermonSlideStore.getState().activeIndex).toBe(1)
    expect(useBroadcastStore.getState().previewItem?.reference).toBe("Sermon - Appeal")
  })
})
