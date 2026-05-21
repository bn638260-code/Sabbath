import type { ServicePlan } from "@/types/service-plan"

export interface ServicePlanAutosave {
  save(plan: ServicePlan, options?: { immediate?: boolean }): Promise<void>
  clear(): void
}

export function createServicePlanAutosave(
  persist: (plan: ServicePlan) => Promise<void>,
  getCurrentPlan: () => ServicePlan | null,
  debounceMs = 400,
): ServicePlanAutosave {
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  return {
    async save(plan, options) {
      if (options?.immediate) {
        if (saveTimer) clearTimeout(saveTimer)
        saveTimer = null
        await persist(plan)
        return
      }

      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        saveTimer = null
        const latest = getCurrentPlan()
        if (latest) void persist(latest)
      }, debounceMs)
    },

    clear() {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = null
    },
  }
}
