import { create } from "zustand"
import { buildServiceContext } from "@/lib/service-plan/service-context"
import { servicePlanRepository } from "@/lib/service-plan/service-plan-repository"
import { createPlanFromTemplate } from "@/lib/service-plan/service-plan-templates"
import {
  findNextServiceItem,
  normalizeItemOrder,
} from "@/lib/service-plan/service-plan-validation"
import { mediaPreloadManager } from "@/services/media/media-preload-manager"
import type {
  ServiceContext,
  ServiceEventLogEntry,
  ServiceItem,
  ServicePlan,
  ServicePlanReport,
  ServicePlanSummary,
} from "@/types/service-plan"

interface ServicePlanState {
  summaries: ServicePlanSummary[]
  activePlan: ServicePlan | null
  serviceContext: ServiceContext
  plannerOpen: boolean
  isHydrated: boolean
  isSaving: boolean
  pendingReport: boolean
  lastReport: ServicePlanReport | null

  hydrate: () => Promise<void>
  openPlanner: () => void
  closePlanner: () => void
  createFromTemplate: (templateId: string, title?: string) => Promise<void>
  loadPlan: (id: string) => Promise<void>
  savePlan: (options?: { immediate?: boolean }) => Promise<void>
  updatePlanTitle: (title: string) => void
  addItem: (item: Omit<ServiceItem, "id" | "order" | "status">) => void
  updateItem: (itemId: string, patch: Partial<ServiceItem>) => void
  deleteItem: (itemId: string) => void
  duplicateItem: (itemId: string) => void
  reorderItems: (fromIndex: number, toIndex: number) => void
  setActiveItem: (itemId: string | null) => Promise<void>
  markItemReady: (itemId: string) => void
  completeActiveItem: () => Promise<void>
  skipActiveItem: () => Promise<void>
  goToNextItem: () => Promise<void>
  goToPreviousItem: () => Promise<void>
  startPractice: () => Promise<void>
  startLiveService: () => Promise<void>
  completeService: () => Promise<void>
  enqueuePreparedResources: () => Promise<void>
  practicePreviewActiveItem: () => Promise<void>
  generatePostServiceReport: () => Promise<void>
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let hydrationPromise: Promise<void> | null = null
const SAVE_DEBOUNCE_MS = 400

function appendEvent(plan: ServicePlan, type: ServiceEventLogEntry["type"], message: string): ServicePlan {
  return {
    ...plan,
    eventLog: [
      {
        id: crypto.randomUUID(),
        at: Date.now(),
        type,
        message,
      },
      ...plan.eventLog,
    ].slice(0, 200),
  }
}

function syncContext(plan: ServicePlan | null): ServiceContext {
  const context = buildServiceContext(plan)
  if (plan) {
    mediaPreloadManager.syncFromContext(context)
  } else {
    mediaPreloadManager.releaseAll()
  }
  return context
}

function patchActivePlan(
  updater: (plan: ServicePlan) => ServicePlan,
  options?: { immediate?: boolean },
): void {
  const current = useServicePlanStore.getState().activePlan
  if (!current) return

  const next = updater({ ...current, updatedAt: Date.now() })
  const serviceContext = syncContext(next)
  useServicePlanStore.setState({ activePlan: next, serviceContext })
  void useServicePlanStore.getState().savePlan({ immediate: options?.immediate })
}

async function persistPlan(plan: ServicePlan): Promise<void> {
  useServicePlanStore.setState({ isSaving: true })
  try {
    await servicePlanRepository.savePlan(plan)
    const summaries = await servicePlanRepository.listSummaries()
    useServicePlanStore.setState({ summaries })
  } finally {
    useServicePlanStore.setState({ isSaving: false })
  }
}

export const useServicePlanStore = create<ServicePlanState>((set, get) => ({
  summaries: [],
  activePlan: null,
  serviceContext: buildServiceContext(null),
  plannerOpen: false,
  isHydrated: false,
  isSaving: false,
  pendingReport: false,
  lastReport: null,

  hydrate: async () => {
    if (hydrationPromise) return hydrationPromise
    hydrationPromise = (async () => {
      const summaries = await servicePlanRepository.listSummaries()
      set({ summaries, isHydrated: true })
    })()
    return hydrationPromise
  },

  openPlanner: () => set({ plannerOpen: true }),
  closePlanner: () => set({ plannerOpen: false }),

  createFromTemplate: async (templateId, title) => {
    const plan = createPlanFromTemplate(templateId, title)
    if (!plan) return
    await servicePlanRepository.savePlan(plan)
    const summaries = await servicePlanRepository.listSummaries()
    set({
      summaries,
      activePlan: plan,
      serviceContext: syncContext(plan),
      plannerOpen: true,
    })
  },

  loadPlan: async (id) => {
    const plan = await servicePlanRepository.loadPlan(id)
    if (!plan) return
    set({
      activePlan: plan,
      serviceContext: syncContext(plan),
      plannerOpen: true,
    })
  },

  savePlan: async (options) => {
    const plan = get().activePlan
    if (!plan) return

    if (options?.immediate) {
      if (saveTimer) clearTimeout(saveTimer)
      await persistPlan(plan)
      return
    }

    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      void persistPlan(get().activePlan!)
    }, SAVE_DEBOUNCE_MS)
  },

  updatePlanTitle: (title) => {
    patchActivePlan((plan) => ({ ...plan, title }))
  },

  addItem: (item) => {
    patchActivePlan((plan) => {
      const order = plan.items.length
      const nextItem: ServiceItem = {
        ...item,
        id: crypto.randomUUID(),
        order,
        status: "pending",
        scriptureRefs: item.scriptureRefs ?? [],
        hymnRefs: item.hymnRefs ?? [],
        mediaRefs: item.mediaRefs ?? [],
        attachments: item.attachments ?? [],
        checklist: item.checklist ?? [],
      }
      return { ...plan, items: [...plan.items, nextItem] }
    })
  },

  updateItem: (itemId, patch) => {
    patchActivePlan((plan) => ({
      ...plan,
      items: plan.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    }))
  },

  deleteItem: (itemId) => {
    patchActivePlan((plan) => {
      const items = normalizeItemOrder(plan.items.filter((item) => item.id !== itemId))
      const activeItemId = plan.activeItemId === itemId ? null : plan.activeItemId
      return { ...plan, items, activeItemId }
    })
  },

  duplicateItem: (itemId) => {
    patchActivePlan((plan) => {
      const source = plan.items.find((item) => item.id === itemId)
      if (!source) return plan
      const copy: ServiceItem = {
        ...source,
        id: crypto.randomUUID(),
        title: `${source.title} (Copy)`,
        order: plan.items.length,
        status: "pending",
      }
      return { ...plan, items: [...plan.items, copy] }
    })
  },

  reorderItems: (fromIndex, toIndex) => {
    patchActivePlan((plan) => {
      const items = [...plan.items].sort((a, b) => a.order - b.order)
      const [moved] = items.splice(fromIndex, 1)
      if (!moved) return plan
      items.splice(toIndex, 0, moved)
      return {
        ...plan,
        items: items.map((item, index) => ({ ...item, order: index })),
      }
    })
  },

  setActiveItem: async (itemId) => {
    patchActivePlan(
      (plan) => {
        const items = plan.items.map((item) => ({
          ...item,
          status:
            item.id === itemId
              ? ("active" as const)
              : item.status === "active"
                ? ("ready" as const)
                : item.status,
        }))
        return appendEvent(
          { ...plan, items, activeItemId: itemId },
          "item_activated",
          itemId ? `Activated item` : "Cleared active item",
        )
      },
      { immediate: true },
    )
  },

  markItemReady: (itemId) => {
    patchActivePlan((plan) => ({
      ...plan,
      items: plan.items.map((item) =>
        item.id === itemId ? { ...item, status: "ready" } : item,
      ),
    }))
  },

  completeActiveItem: async () => {
    const plan = get().activePlan
    if (!plan?.activeItemId) return

    patchActivePlan(
      (plan) => {
        const items = plan.items.map((item) =>
          item.id === plan.activeItemId ? { ...item, status: "completed" as const } : item,
        )
        const next = findNextServiceItem(items, plan.activeItemId)
        const nextItems = items.map((item) =>
          next && item.id === next.id ? { ...item, status: "active" as const } : item,
        )
        const completedItem = plan.items.find((item) => item.id === plan.activeItemId)
        const nextPlan = appendEvent(
          {
            ...plan,
            items: nextItems,
            activeItemId: next?.id ?? null,
          },
          "item_completed",
          "Completed active item",
        )
        if (completedItem) {
          for (const attachment of completedItem.attachments) {
            mediaPreloadManager.releaseCompletedItem(attachment.id)
          }
          for (const media of completedItem.mediaRefs) {
            mediaPreloadManager.releaseCompletedItem(media.attachmentId)
          }
        }
        return nextPlan
      },
      { immediate: true },
    )
  },

  skipActiveItem: async () => {
    const plan = get().activePlan
    if (!plan?.activeItemId) return

    patchActivePlan(
      (plan) => {
        const items = plan.items.map((item) =>
          item.id === plan.activeItemId ? { ...item, status: "skipped" as const } : item,
        )
        const next = findNextServiceItem(items, plan.activeItemId)
        const nextItems = items.map((item) =>
          next && item.id === next.id ? { ...item, status: "active" as const } : item,
        )
        return appendEvent(
          {
            ...plan,
            items: nextItems,
            activeItemId: next?.id ?? null,
          },
          "item_skipped",
          "Skipped active item",
        )
      },
      { immediate: true },
    )
  },

  goToNextItem: async () => {
    const plan = get().activePlan
    if (!plan) return
    const next = findNextServiceItem(plan.items, plan.activeItemId)
    if (!next) return
    await get().setActiveItem(next.id)
  },

  goToPreviousItem: async () => {
    const plan = get().activePlan
    if (!plan?.activeItemId) return
    const ordered = normalizeItemOrder(plan.items)
    const index = ordered.findIndex((item) => item.id === plan.activeItemId)
    if (index <= 0) return
    await get().setActiveItem(ordered[index - 1].id)
  },

  startPractice: async () => {
    patchActivePlan(
      (plan) =>
        appendEvent(
          { ...plan, status: "practice", mode: "practice" },
          "mode_changed",
          "Practice mode started",
        ),
      { immediate: true },
    )
  },

  startLiveService: async () => {
    patchActivePlan(
      (plan) =>
        appendEvent(
          { ...plan, status: "live", mode: "performance" },
          "mode_changed",
          "Live service started",
        ),
      { immediate: true },
    )

    const plan = get().activePlan
    if (plan && !plan.activeItemId) {
      const first = findNextServiceItem(plan.items, null)
      if (first) await get().setActiveItem(first.id)
    }
  },

  completeService: async () => {
    patchActivePlan(
      (plan) =>
        appendEvent(
          { ...plan, status: "completed", mode: "planning", activeItemId: null },
          "mode_changed",
          "Service completed",
        ),
      { immediate: true },
    )
    set({ pendingReport: true })
    mediaPreloadManager.releaseAll()
  },

  enqueuePreparedResources: async () => {
    const plan = get().activePlan
    const active = plan?.items.find((item) => item.id === plan.activeItemId)
    if (!active) return
    const { enqueuePreparedResourcesForItem } = await import(
      "@/lib/service-plan/prepare-queue-resources"
    )
    await enqueuePreparedResourcesForItem(active)
  },

  practicePreviewActiveItem: async () => {
    const plan = get().activePlan
    if (!plan || plan.mode !== "practice") return

    const active = plan.items.find((item) => item.id === plan.activeItemId)
    if (!active) return

    const { selectPreviewItem } = await import("@/lib/presentation-workflow")
    const { createHymnPresentationItem, defaultSelectedSectionIds } = await import(
      "@/services/hymnal/hymn-presentation"
    )
    const { generateHymnScreens } = await import("@/services/hymnal/generate-hymn-screens")
    const { getHymnByNumber } = await import("@/services/hymnal/hymnal-repository")

    for (const hymnRef of active.hymnRefs) {
      if (!hymnRef.hymnNumber) continue
      try {
        const hymn = await getHymnByNumber(hymnRef.hymnNumber)
        if (!hymn) continue
        const screens = generateHymnScreens({
          hymn,
          selectedSectionIds: defaultSelectedSectionIds(hymn),
          maxLinesPerScreen: 4,
        })
        const first = screens[0]
        if (!first) continue
        selectPreviewItem(createHymnPresentationItem(first))
        return
      } catch {
        // Practice preview failure is non-fatal.
      }
    }
  },

  generatePostServiceReport: async () => {
    const plan = get().activePlan
    if (!plan) return
    const { generateServicePlanReport } = await import("@/lib/service-plan/service-plan-report")
    const report = generateServicePlanReport(plan)
    patchActivePlan(
      (current) => ({
        ...current,
        reportGeneratedAt: report.generatedAt,
      }),
      { immediate: true },
    )
    set({ pendingReport: false, lastReport: report })
  },
}))

export function hydrateServicePlans(): Promise<void> {
  return useServicePlanStore.getState().hydrate()
}

export function getServiceContext(): ServiceContext {
  return useServicePlanStore.getState().serviceContext
}
