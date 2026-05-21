import type { ServicePlan, ServicePlanReport } from "@/types/service-plan"

export function generateServicePlanReport(plan: ServicePlan): ServicePlanReport {
  const completedItems = plan.items.filter((item) => item.status === "completed").length
  const skippedItems = plan.items.filter((item) => item.status === "skipped").length
  const durationEstimateMinutes = plan.items.reduce(
    (total, item) => total + (item.durationMinutes ?? 0),
    0,
  )

  return {
    planId: plan.id,
    title: plan.title,
    generatedAt: Date.now(),
    completedItems,
    skippedItems,
    totalItems: plan.items.length,
    durationEstimateMinutes,
    eventHighlights: plan.eventLog.slice(0, 12).map((entry) => entry.message),
    itemSummaries: plan.items.map((item) => ({
      title: item.title,
      status: item.status,
      kind: item.kind,
    })),
  }
}
