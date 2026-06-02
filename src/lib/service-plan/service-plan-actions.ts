import {
  findNextServiceItem,
  normalizeItemOrder,
} from "@/lib/service-plan/service-plan-validation"
import type {
  ServiceEventLogEntry,
  ServiceItem,
  ServicePlan,
} from "@/types/service-plan"

export function appendServiceEvent(
  plan: ServicePlan,
  type: ServiceEventLogEntry["type"],
  message: string
): ServicePlan {
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

export function addServiceItem(
  plan: ServicePlan,
  item: Omit<ServiceItem, "id" | "order" | "status">
): ServicePlan {
  const nextItem: ServiceItem = {
    ...item,
    id: crypto.randomUUID(),
    order: plan.items.length,
    status: "pending",
    scriptureRefs: item.scriptureRefs ?? [],
    hymnRefs: item.hymnRefs ?? [],
    mediaRefs: item.mediaRefs ?? [],
    attachments: item.attachments ?? [],
    checklist: item.checklist ?? [],
  }
  return { ...plan, items: [...plan.items, nextItem] }
}

export function updateServiceItem(
  plan: ServicePlan,
  itemId: string,
  patch: Partial<ServiceItem>
): ServicePlan {
  return {
    ...plan,
    items: plan.items.map((item) =>
      item.id === itemId ? { ...item, ...patch } : item
    ),
  }
}

export function deleteServiceItem(
  plan: ServicePlan,
  itemId: string
): ServicePlan {
  return {
    ...plan,
    items: normalizeItemOrder(plan.items.filter((item) => item.id !== itemId)),
    activeItemId: plan.activeItemId === itemId ? null : plan.activeItemId,
  }
}

export function duplicateServiceItem(
  plan: ServicePlan,
  itemId: string
): ServicePlan {
  const source = plan.items.find((item) => item.id === itemId)
  if (!source) return plan

  const copy = cloneServiceItem(source, {
    title: `${source.title} (Copy)`,
    order: plan.items.length,
  })
  return { ...plan, items: [...plan.items, copy] }
}

export function cloneServiceItem(
  source: ServiceItem,
  overrides: Partial<ServiceItem> = {}
): ServiceItem {
  const attachmentIds = new Map<string, string>()
  const attachments = source.attachments.map((attachment) => {
    const id = crypto.randomUUID()
    attachmentIds.set(attachment.id, id)
    return { ...attachment, id }
  })

  return {
    ...source,
    ...overrides,
    id: crypto.randomUUID(),
    status: "pending",
    scriptureRefs: source.scriptureRefs.map((ref) => ({ ...ref })),
    hymnRefs: source.hymnRefs.map((ref) => ({ ...ref })),
    mediaRefs: source.mediaRefs.map((ref) => ({
      ...ref,
      attachmentId: attachmentIds.get(ref.attachmentId) ?? ref.attachmentId,
    })),
    attachments,
    checklist: source.checklist.map((entry) => ({
      ...entry,
      id: crypto.randomUUID(),
    })),
  }
}

export function reorderServiceItems(
  plan: ServicePlan,
  fromIndex: number,
  toIndex: number
): ServicePlan {
  const items = [...plan.items].sort((a, b) => a.order - b.order)
  const [moved] = items.splice(fromIndex, 1)
  if (!moved) return plan
  items.splice(toIndex, 0, moved)
  return {
    ...plan,
    items: items.map((item, index) => ({ ...item, order: index })),
  }
}

export function setActiveServiceItem(
  plan: ServicePlan,
  itemId: string | null
): ServicePlan {
  const items = plan.items.map((item) => ({
    ...item,
    status:
      item.id === itemId
        ? ("active" as const)
        : item.status === "active"
          ? ("ready" as const)
          : item.status,
  }))
  return appendServiceEvent(
    { ...plan, items, activeItemId: itemId },
    "item_activated",
    itemId ? "Activated item" : "Cleared active item"
  )
}

export function setServiceItemReady(
  plan: ServicePlan,
  itemId: string
): ServicePlan {
  return updateServiceItem(plan, itemId, { status: "ready" })
}

export function completeCurrentServiceItem(plan: ServicePlan): ServicePlan {
  if (!plan.activeItemId) return plan

  const items = plan.items.map((item) =>
    item.id === plan.activeItemId
      ? { ...item, status: "completed" as const }
      : item
  )
  const next = findNextServiceItem(items, plan.activeItemId)
  const nextItems = items.map((item) =>
    next && item.id === next.id ? { ...item, status: "active" as const } : item
  )

  return appendServiceEvent(
    { ...plan, items: nextItems, activeItemId: next?.id ?? null },
    "item_completed",
    "Completed active item"
  )
}

export function skipCurrentServiceItem(plan: ServicePlan): ServicePlan {
  if (!plan.activeItemId) return plan

  const items = plan.items.map((item) =>
    item.id === plan.activeItemId
      ? { ...item, status: "skipped" as const }
      : item
  )
  const next = findNextServiceItem(items, plan.activeItemId)
  const nextItems = items.map((item) =>
    next && item.id === next.id ? { ...item, status: "active" as const } : item
  )

  return appendServiceEvent(
    { ...plan, items: nextItems, activeItemId: next?.id ?? null },
    "item_skipped",
    "Skipped active item"
  )
}

export function startPracticeMode(plan: ServicePlan): ServicePlan {
  return appendServiceEvent(
    { ...plan, status: "practice", mode: "practice" },
    "mode_changed",
    "Practice mode started"
  )
}

export function startLiveServiceMode(plan: ServicePlan): ServicePlan {
  return appendServiceEvent(
    { ...plan, status: "live", mode: "performance" },
    "mode_changed",
    "Live service started"
  )
}

export function completeServicePlan(plan: ServicePlan): ServicePlan {
  return appendServiceEvent(
    {
      ...plan,
      status: "completed",
      mode: "planning",
      activeItemId: null,
      items: plan.items.map((item) =>
        item.status === "active"
          ? { ...item, status: "completed" as const }
          : item
      ),
    },
    "mode_changed",
    "Service completed"
  )
}
