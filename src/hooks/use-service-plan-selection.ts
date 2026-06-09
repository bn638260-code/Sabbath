import { useMemo, useState } from "react"
import type { ServiceItem, ServicePlan } from "@/types/service-plan"

export function useServicePlanSelection(activePlan: ServicePlan | null) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    () =>
      activePlan?.activeItemId ??
      [...(activePlan?.items ?? [])].sort((a, b) => a.order - b.order)[0]?.id ??
      null,
  )

  const selectedItem = useMemo(
    (): ServiceItem | null =>
      activePlan?.items.find((item) => item.id === selectedItemId) ??
      activePlan?.items.find((item) => item.id === activePlan.activeItemId) ??
      [...(activePlan?.items ?? [])].sort((a, b) => a.order - b.order)[0] ??
      null,
    [activePlan, selectedItemId],
  )

  return { selectedItemId, setSelectedItemId, selectedItem }
}
