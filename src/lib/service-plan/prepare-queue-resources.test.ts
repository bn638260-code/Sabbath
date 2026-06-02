import { beforeEach, describe, expect, it, vi } from "vitest"
import { enqueuePreparedResourcesForItem } from "./prepare-queue-resources"
import { useQueueStore } from "@/stores/queue-store"
import type { ServiceItem } from "@/types/service-plan"

vi.mock("@/services/hymnal/hymnal-repository", () => ({
  getHymnByNumber: vi.fn(async (number: number) => ({
    id: `hymn-${number}`,
    number,
    title: `Hymn ${number}`,
    sections: [{ id: "s1", label: "Verse 1", lines: ["Line one", "Line two"] }],
  })),
}))

vi.mock("@/services/hymnal/generate-hymn-screens", () => ({
  generateHymnScreens: vi.fn(() => [
    {
      id: "screen-0",
      hymnId: "hymn-1",
      hymnNumber: 1,
      hymnTitle: "Hymn 1",
      sectionLabel: "Verse 1",
      sectionScreenIndex: 0,
      sectionScreenCount: 2,
      screenIndex: 0,
      totalScreens: 2,
      lines: ["Line one"],
    },
    {
      id: "screen-1",
      hymnId: "hymn-1",
      hymnNumber: 1,
      hymnTitle: "Hymn 1",
      sectionLabel: "Verse 1",
      sectionScreenIndex: 1,
      sectionScreenCount: 2,
      screenIndex: 1,
      totalScreens: 2,
      lines: ["Line two"],
    },
  ]),
}))

vi.mock("@/hooks/use-bible", () => ({
  bibleActions: {
    loadBooks: vi.fn(async () => []),
    fetchVerse: vi.fn(async () => null),
  },
}))

function itemWithHymn(): ServiceItem {
  return {
    id: "item-1",
    order: 0,
    title: "Opening hymn",
    kind: "hymn",
    status: "active",
    scriptureRefs: [],
    hymnRefs: [{ hymnNumber: 1 }],
    mediaRefs: [],
    attachments: [],
    checklist: [],
  }
}

describe("enqueuePreparedResourcesForItem", () => {
  beforeEach(() => {
    useQueueStore.setState({ items: [], activeIndex: null })
  })

  it("enqueues the full grouped hymn deck for a hymn item", async () => {
    const queued = await enqueuePreparedResourcesForItem(itemWithHymn())
    const items = useQueueStore.getState().items

    expect(queued).toBe(2)
    expect(items).toHaveLength(2)
    expect(items.every((entry) => entry.presentation.kind === "hymn")).toBe(true)
    expect(items[0].hymnGroup?.groupId).toBe(items[1].hymnGroup?.groupId)
    expect(items[0].hymnGroup?.itemCount).toBe(2)
    expect(items[0].source).toBe("service-plan")
  })
})
