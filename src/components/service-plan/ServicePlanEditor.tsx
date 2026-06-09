import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PanelHeader } from "@/components/ui/panel-header"
import { useServicePlanSelection } from "@/hooks/use-service-plan-selection"
import { useServicePlanStore } from "@/stores/service-plan-store"
import {
  CalendarClockIcon,
  ClipboardListIcon,
  PlayIcon,
  RadioIcon,
  SkipForwardIcon,
} from "lucide-react"
import { ServiceItemDetailsPanel } from "./ServiceItemDetailsPanel"
import { ServiceTimeline } from "./ServiceTimeline"

export function ServicePlanEditor() {
  const activePlan = useServicePlanStore((s) => s.activePlan)
  const serviceContext = useServicePlanStore((s) => s.serviceContext)
  const updatePlanTitle = useServicePlanStore((s) => s.updatePlanTitle)
  const updateItem = useServicePlanStore((s) => s.updateItem)
  const setActiveItem = useServicePlanStore((s) => s.setActiveItem)
  const deleteItem = useServicePlanStore((s) => s.deleteItem)
  const duplicateItem = useServicePlanStore((s) => s.duplicateItem)
  const reorderItems = useServicePlanStore((s) => s.reorderItems)
  const markItemReady = useServicePlanStore((s) => s.markItemReady)
  const completeActiveItem = useServicePlanStore((s) => s.completeActiveItem)
  const skipActiveItem = useServicePlanStore((s) => s.skipActiveItem)
  const goToNextItem = useServicePlanStore((s) => s.goToNextItem)
  const goToPreviousItem = useServicePlanStore((s) => s.goToPreviousItem)
  const startPractice = useServicePlanStore((s) => s.startPractice)
  const startLiveService = useServicePlanStore((s) => s.startLiveService)
  const completeService = useServicePlanStore((s) => s.completeService)
  const enqueuePreparedResources = useServicePlanStore(
    (s) => s.enqueuePreparedResources,
  )
  const practicePreviewActiveItem = useServicePlanStore(
    (s) => s.practicePreviewActiveItem,
  )
  const generatePostServiceReport = useServicePlanStore(
    (s) => s.generatePostServiceReport,
  )
  const addItem = useServicePlanStore((s) => s.addItem)
  const pendingReport = useServicePlanStore((s) => s.pendingReport)
  const lastReport = useServicePlanStore((s) => s.lastReport)
  const { selectedItem, setSelectedItemId } = useServicePlanSelection(activePlan)

  if (!activePlan) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No active service plan.
      </div>
    )
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-slot="service-plan-editor"
    >
      <PanelHeader
        title={activePlan.title}
        icon={<ClipboardListIcon className="size-4" />}
      >
        <Badge variant="outline" className="text-[0.5625rem] uppercase">
          {activePlan.status}
        </Badge>
      </PanelHeader>

      <div className="border-b border-white/5 px-4 py-3">
        <Input
          value={activePlan.title}
          onChange={(event) => updatePlanTitle(event.target.value)}
          className="h-8"
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="flex min-h-0 flex-col border-r border-white/5">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <span className="text-xs font-medium text-muted-foreground">
              Timeline
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={serviceContext.performanceMode}
              onClick={() =>
                addItem({
                  title: "New item",
                  kind: "general",
                  scriptureRefs: [],
                  hymnRefs: [],
                  mediaRefs: [],
                  attachments: [],
                  checklist: [],
                })
              }
            >
              Add item
            </Button>
          </div>
          <div className="min-h-0 flex-1 p-3">
            <ServiceTimeline
              items={activePlan.items}
              activeItemId={activePlan.activeItemId}
              performanceMode={serviceContext.performanceMode}
              onSelect={setSelectedItemId}
              onActivate={(itemId) => void setActiveItem(itemId)}
              onDuplicate={duplicateItem}
              onDelete={deleteItem}
              onMarkReady={markItemReady}
              onComplete={() => void completeActiveItem()}
              onReorder={reorderItems}
            />
          </div>
        </div>

        <ServiceItemDetailsPanel
          item={selectedItem}
          serviceContext={serviceContext}
          onPatchItem={(patch) => {
            if (!selectedItem) return
            updateItem(selectedItem.id, patch)
          }}
          onEnqueuePrepared={() => void enqueuePreparedResources()}
          onPracticePreview={() => void practicePreviewActiveItem()}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-white/5 px-4 py-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void startPractice()}
        >
          <PlayIcon className="size-3.5" />
          Practice
        </Button>
        <Button size="sm" onClick={() => void startLiveService()}>
          <RadioIcon className="size-3.5" />
          Start service
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void goToPreviousItem()}
        >
          Previous
        </Button>
        <Button size="sm" variant="outline" onClick={() => void goToNextItem()}>
          <SkipForwardIcon className="size-3.5" />
          Next
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void skipActiveItem()}
        >
          Skip
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void completeService()}
        >
          Complete service
        </Button>
        {pendingReport && (
          <Button
            size="sm"
            variant="outline"
            onClick={generatePostServiceReport}
          >
            <CalendarClockIcon className="size-3.5" />
            Generate report
          </Button>
        )}
      </div>
      {lastReport && (
        <div className="border-t border-white/5 px-4 py-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">Post-service report</div>
          <div>
            {lastReport.completedItems}/{lastReport.totalItems} items completed
            - {lastReport.skippedItems} skipped - ~
            {lastReport.durationEstimateMinutes} min planned
          </div>
        </div>
      )}
    </div>
  )
}
