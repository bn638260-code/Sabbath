import { Button } from "@/components/ui/button"
import { useServicePlanStore } from "@/stores/service-plan-store"

export function ServicePlanSummaryWidget() {
  const summaries = useServicePlanStore((s) => s.summaries)
  const loadPlan = useServicePlanStore((s) => s.loadPlan)
  const openPlanner = useServicePlanStore((s) => s.openPlanner)

  if (summaries.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-white/5 px-3 py-4 text-xs text-muted-foreground">
        No service plans yet.
      </div>
    )
  }

  return (
    <div className="space-y-2" data-slot="service-plan-summary">
      {summaries.slice(0, 4).map((summary) => (
        <button
          key={summary.id}
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-white/5 px-3 py-2 text-left text-xs hover:bg-white/5"
          onClick={() => void loadPlan(summary.id)}
        >
          <span className="font-medium">{summary.title}</span>
          <span className="text-muted-foreground">
            {summary.completedCount}/{summary.itemCount}
          </span>
        </button>
      ))}
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={openPlanner}
      >
        Open planner
      </Button>
    </div>
  )
}
