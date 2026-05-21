import type { ServiceItem, ServicePlan } from "@/types/service-plan"

export function isValidServicePlan(plan: ServicePlan): boolean {
  if (!plan.id || !plan.title.trim()) return false
  if (!Array.isArray(plan.items)) return false
  return plan.items.every(isValidServiceItem)
}

export function isValidServiceItem(item: ServiceItem): boolean {
  return Boolean(item.id && item.title.trim() && Number.isFinite(item.order))
}

export function normalizeItemOrder(items: ServiceItem[]): ServiceItem[] {
  return [...items]
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }))
}

export function findNextServiceItem(
  items: ServiceItem[],
  activeItemId: string | null,
): ServiceItem | null {
  const ordered = normalizeItemOrder(items)
  if (ordered.length === 0) return null

  if (!activeItemId) {
    return ordered.find((item) => item.status !== "completed" && item.status !== "skipped") ?? null
  }

  const activeIndex = ordered.findIndex((item) => item.id === activeItemId)
  if (activeIndex === -1) {
    return ordered.find((item) => item.status !== "completed" && item.status !== "skipped") ?? null
  }

  for (let index = activeIndex + 1; index < ordered.length; index += 1) {
    const candidate = ordered[index]
    if (candidate.status !== "completed" && candidate.status !== "skipped") {
      return candidate
    }
  }

  return null
}
