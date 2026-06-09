import { lazy, Suspense } from "react"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { ServicePlanLibraryPanel } from "./ServicePlanLibraryPanel"

const LazyServicePlanEditor = lazy(() =>
  import("./ServicePlanEditor").then((mod) => ({
    default: mod.ServicePlanEditor,
  })),
)

export function ServicePlanWorkspace() {
  const activePlan = useServicePlanStore((s) => s.activePlan)

  return (
    <div
      className="view-pane grid min-h-full grid-cols-1 gap-5 xl:grid-cols-[300px_minmax(0,1fr)]"
      data-slot="service-plan-workspace"
    >
      <ServicePlanLibraryPanel />
      <div className="glass-panel relative min-h-[520px] overflow-hidden">
        {activePlan ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading planner...
              </div>
            }
          >
            <LazyServicePlanEditor key={activePlan.id} />
          </Suspense>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Create a plan from a template to begin.
          </div>
        )}
      </div>
    </div>
  )
}
