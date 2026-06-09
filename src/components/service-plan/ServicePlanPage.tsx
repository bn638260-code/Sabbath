import { lazy, Suspense } from "react"

export { ServiceLiveContextPanel } from "./ServiceLiveContextPanel"
export { ServicePlanEditor } from "./ServicePlanEditor"
export { ServicePlanSummaryWidget } from "./ServicePlanSummaryWidget"
export { ServicePlanLibraryPanel } from "./ServicePlanLibraryPanel"
export { ServicePlanDialog } from "./ServicePlanDialog"
export { RunServicePage } from "./RunServicePage"
export { LiveServicePlanPage } from "./LiveServicePlanPage"
export { LiveHymnPage } from "./LiveHymnPage"
export { SermonSlidesPage } from "./SermonSlidesPage"
export { LiveProductionGrid } from "./LiveProductionGrid"

const LazyServicePlanWorkspace = lazy(() =>
  import("./ServicePlanWorkspace").then((mod) => ({
    default: mod.ServicePlanWorkspace,
  })),
)

export function ServicePlanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading service plan...
        </div>
      }
    >
      <LazyServicePlanWorkspace />
    </Suspense>
  )
}
