import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildServiceContext } from "./service-context"
import { createPlanFromTemplate } from "./service-plan-templates"
import { resetServicePlanRepositoryForTests } from "./service-plan-repository"
import { mediaPreloadManager } from "@/services/media/media-preload-manager"

vi.mock("@/stores/queue-store", () => ({
  useQueueStore: {
    getState: () => ({
      addItem: vi.fn(),
      items: [],
    }),
  },
}))

describe("service context adapter", () => {
  beforeEach(() => {
    resetServicePlanRepositoryForTests()
    mediaPreloadManager.releaseAll()
  })

  it("returns safe empty context when no plan is loaded", () => {
    const context = buildServiceContext(null)
    expect(context).toMatchObject({
      planId: "",
      activeItem: null,
      nextItem: null,
      expectedReferences: [],
      hymnSummaries: [],
      mediaSummaries: [],
      performanceMode: false,
    })
  })

  it("omits full plan data and exposes active/next summaries only", () => {
    const plan = createPlanFromTemplate("standard-sabbath")!
    const [first, second] = plan.items
    plan.activeItemId = first.id
    first.status = "active"
    first.hymnRefs = [{ hymnNumber: 1, title: "Praise to the Lord" }]
    second.hymnRefs = [{ hymnNumber: 2, title: "All creatures" }]

    const context = buildServiceContext(plan)

    expect(context.planId).toBe(plan.id)
    expect(context.activeItem).toMatchObject({ id: first.id, title: first.title })
    expect(context.nextItem?.id).toBe(second.id)
    expect(context.hymnSummaries).toEqual([
      { hymnNumber: 1, title: "Praise to the Lord" },
      { hymnNumber: 2, title: "All creatures" },
    ])
    expect(context).not.toHaveProperty("items")
    expect(context).not.toHaveProperty("eventLog")
  })

  it("enables performance mode during live service", () => {
    const plan = createPlanFromTemplate("blank")!
    plan.status = "live"
    plan.mode = "performance"
    const context = buildServiceContext(plan)
    expect(context.performanceMode).toBe(true)
  })
})

describe("service plan store behavior", () => {
  beforeEach(async () => {
    resetServicePlanRepositoryForTests()
    vi.resetModules()
  })

  it("transitions active item and saves immediately on live start", async () => {
    const plan = createPlanFromTemplate("prayer-meeting")!
    const { useServicePlanStore } = await import("@/stores/service-plan-store")
    const { buildServiceContext } = await import("./service-context")
    useServicePlanStore.setState({
      activePlan: plan,
      serviceContext: buildServiceContext(plan),
    })

    await useServicePlanStore.getState().startLiveService()

    const state = useServicePlanStore.getState()
    expect(state.activePlan?.status).toBe("live")
    expect(state.activePlan?.mode).toBe("performance")
    expect(state.serviceContext.performanceMode).toBe(true)
    expect(state.activePlan?.activeItemId).toBeTruthy()
  })

  it("deduplicates item order on reorder", async () => {
    const plan = createPlanFromTemplate("blank")!
    plan.items = [
      {
        id: "a",
        order: 0,
        title: "A",
        kind: "general",
        status: "pending",
        scriptureRefs: [],
        hymnRefs: [],
        mediaRefs: [],
        attachments: [],
        checklist: [],
      },
      {
        id: "b",
        order: 1,
        title: "B",
        kind: "general",
        status: "pending",
        scriptureRefs: [],
        hymnRefs: [],
        mediaRefs: [],
        attachments: [],
        checklist: [],
      },
    ]
    const { useServicePlanStore } = await import("@/stores/service-plan-store")
    const { buildServiceContext } = await import("./service-context")
    useServicePlanStore.setState({
      activePlan: plan,
      serviceContext: buildServiceContext(plan),
    })
    useServicePlanStore.getState().reorderItems(1, 0)

    const items = useServicePlanStore.getState().activePlan?.items ?? []
    expect(items.map((item) => item.title)).toEqual(["B", "A"])
    expect(items.map((item) => item.order)).toEqual([0, 1])
  })

  it("auto-selects the first item when practice mode starts", async () => {
    const plan = createPlanFromTemplate("prayer-meeting")!
    plan.activeItemId = null
    const { useServicePlanStore } = await import("@/stores/service-plan-store")
    const { buildServiceContext } = await import("./service-context")
    useServicePlanStore.setState({
      activePlan: plan,
      serviceContext: buildServiceContext(plan),
    })

    await useServicePlanStore.getState().startPractice()

    const state = useServicePlanStore.getState()
    expect(state.activePlan?.status).toBe("practice")
    expect(state.activePlan?.mode).toBe("practice")
    expect(state.activePlan?.activeItemId).toBe(plan.items[0]?.id)
  })

})

describe("media preload and live integration smoke", () => {
  beforeEach(() => {
    mediaPreloadManager.releaseAll()
  })

  it("preloads only media referenced by active/next context", () => {
    const plan = createPlanFromTemplate("blank")!
    const active = plan.items[0] ?? {
      id: "x",
      order: 0,
      title: "Media block",
      kind: "media" as const,
      status: "active" as const,
      scriptureRefs: [],
      hymnRefs: [],
      mediaRefs: [],
      attachments: [
        {
          id: "media-1",
          kind: "media" as const,
          label: "/tmp/active.mp4",
          status: "pending" as const,
        },
      ],
      checklist: [],
    }
    plan.items = [active]
    plan.activeItemId = active.id

    const context = buildServiceContext(plan)
    mediaPreloadManager.syncFromContext(context, ["/tmp/emergency.mp4"])

    const ids = mediaPreloadManager.getPreloadedIds()
    expect(ids).toContain("media-1")
    expect(mediaPreloadManager.getPreloadedIds().length).toBeLessThanOrEqual(2)
  })

  it(
    "does not import the full planner from the live context panel module",
    async () => {
    const mod = await import("@/components/service-plan/ServiceLiveContextPanel")
    expect(mod.ServiceLiveContextPanel).toBeTypeOf("function")
    const source = mod.ServiceLiveContextPanel.toString()
    expect(source).not.toContain("activePlan")
    expect(source).toContain("serviceContext")
    },
    15000,
  )

  it("generates a post-service report summary", async () => {
    const plan = createPlanFromTemplate("standard-sabbath")!
    plan.items[0]!.status = "completed"
    const { generateServicePlanReport } = await import("./service-plan-report")
    const report = generateServicePlanReport(plan)
    expect(report.completedItems).toBe(1)
    expect(report.itemSummaries.length).toBe(plan.items.length)
  })

  it("tracks scoped media preload status for active resources", () => {
    const plan = createPlanFromTemplate("blank")!
    const active = {
      id: "media-item",
      order: 0,
      title: "Media",
      kind: "media" as const,
      status: "active" as const,
      scriptureRefs: [],
      hymnRefs: [],
      mediaRefs: [{ attachmentId: "media-1", label: "/tmp/active.mp4", path: "/tmp/active.mp4" }],
      attachments: [],
      checklist: [],
    }
    plan.items = [active]
    plan.activeItemId = active.id

    const context = buildServiceContext(plan)
    mediaPreloadManager.syncFromContext(context)

    expect(["loading", "ready"]).toContain(
      mediaPreloadManager.getPreloadStatus("media-1"),
    )
    expect(mediaPreloadManager.getActiveNextIds(context)).toContain("media-1")
  })
})
