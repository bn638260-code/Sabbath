import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PanelHeader } from "@/components/ui/panel-header"
import { ResizeHandle } from "@/components/layout/dashboard"
import {
  clampNumber,
  loadDashboardLayoutState,
  saveDashboardLayoutState,
} from "@/lib/dashboard-layout"
import { LiveOutputPanel } from "@/components/panels/live-output-panel"
import { PreviewPanel } from "@/components/panels/preview-panel"
import { QueuePanel } from "@/components/panels/queue-panel"
import { TranscriptPanel } from "@/components/panels/transcript-panel"
import { SERVICE_PLAN_TEMPLATES } from "@/lib/service-plan/service-plan-templates"
import { useServicePlanStore } from "@/stores/service-plan-store"
import {
  CalendarClockIcon,
  ClipboardListIcon,
  FileTextIcon,
  ImagesIcon,
  PlayIcon,
  RadioIcon,
  SkipForwardIcon,
  ListMusicIcon,
} from "lucide-react"
import { ServiceTimeline } from "./ServiceTimeline"
import { ServiceLiveContextPanel } from "./ServiceLiveContextPanel"
import { ServiceItemDetailsPanel } from "./ServiceItemDetailsPanel"
import { SermonSlidesEditor } from "./SermonSlidesEditor"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { CanvasPresentation } from "@/components/ui/canvas-verse"
import { selectPreviewItem, presentItem } from "@/lib/presentation-workflow"
import { presentationDeckKind } from "@/lib/presentation-deck-navigation"
import { PresentationDeckControls } from "@/components/panels/presentation-deck-controls"
import { buildSermonSlideDeck } from "@/services/slides/sermon-slide-deck"
import {
  loadActiveSermonSlideDeck,
  presentSermonSlideAt,
} from "@/services/slides/sermon-slide-voice-control"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import { getPresentationRenderData } from "@/types"
import type {
  ServiceAttachment,
  ServiceContextItem,
  ServiceItem,
} from "@/types/service-plan"

export { ServiceLiveContextPanel } from "./ServiceLiveContextPanel"

function activeItemContentLabel(
  item: ServiceItem | ServiceContextItem | null | undefined,
): string {
  if (!item) return "No active item"
  if ("attachments" in item && item.attachments.some((a) => a.kind === "slide")) {
    return "Sermon slides"
  }
  if ("hymnRefs" in item && item.hymnRefs.length > 0) return "Hymn"
  if ("scriptureRefs" in item && item.scriptureRefs.length > 0) return "Scripture"
  if ("mediaRefs" in item && item.mediaRefs.length > 0) return "Media"
  return item.kind
}

const LazyServicePlanEditor = lazy(async () => ({
  default: ServicePlanEditor,
}))

function ServicePlanEditor() {
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
    (s) => s.enqueuePreparedResources
  )
  const practicePreviewActiveItem = useServicePlanStore(
    (s) => s.practicePreviewActiveItem
  )
  const generatePostServiceReport = useServicePlanStore(
    (s) => s.generatePostServiceReport
  )
  const addItem = useServicePlanStore((s) => s.addItem)
  const pendingReport = useServicePlanStore((s) => s.pendingReport)
  const lastReport = useServicePlanStore((s) => s.lastReport)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    () =>
      activePlan?.activeItemId ??
      [...(activePlan?.items ?? [])].sort((a, b) => a.order - b.order)[0]?.id ??
      null
  )

  const selectedItem = useMemo(
    () =>
      activePlan?.items.find((item) => item.id === selectedItemId) ??
      activePlan?.items.find((item) => item.id === activePlan.activeItemId) ??
      [...(activePlan?.items ?? [])].sort((a, b) => a.order - b.order)[0] ??
      null,
    [activePlan, selectedItemId]
  )

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

      <div className="border-b border-border px-4 py-3">
        <Input
          value={activePlan.title}
          onChange={(event) => updatePlanTitle(event.target.value)}
          className="h-8"
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="flex min-h-0 flex-col border-r border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
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

      <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3">
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
        <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
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

export function ServicePlanSummaryWidget() {
  const summaries = useServicePlanStore((s) => s.summaries)
  const loadPlan = useServicePlanStore((s) => s.loadPlan)
  const openPlanner = useServicePlanStore((s) => s.openPlanner)

  if (summaries.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
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
          className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-xs hover:bg-muted/40"
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

export function ServicePlanLibraryPanel() {
  const createFromTemplate = useServicePlanStore((s) => s.createFromTemplate)
  const hydrate = useServicePlanStore((s) => s.hydrate)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    <div
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
      data-slot="service-plan-page"
    >
      <div className="space-y-4 overflow-y-auto p-4">
        <PanelHeader
          title="Service Plan"
          icon={<ClipboardListIcon className="size-4" />}
        />
        <ServicePlanSummaryWidget />
        <div className="grid gap-3">
          {SERVICE_PLAN_TEMPLATES.map((template) => (
            <Button
              key={template.id}
              variant="outline"
              size="sm"
              className="h-auto justify-start py-2 text-left"
              onClick={() => void createFromTemplate(template.id)}
            >
              <div>
                <div className="text-xs font-medium">{template.label}</div>
                <div className="text-[0.625rem] text-muted-foreground">
                  {template.description}
                </div>
              </div>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ServicePlanWorkspace() {
  const activePlan = useServicePlanStore((s) => s.activePlan)
  const [libraryWidth, setLibraryWidth] = useState(
    () => loadDashboardLayoutState().servicePlanLibraryWidth
  )

  useEffect(() => {
    const layout = loadDashboardLayoutState()
    if (layout.servicePlanLibraryWidth !== libraryWidth) {
      layout.servicePlanLibraryWidth = libraryWidth
      saveDashboardLayoutState(layout)
    }
  }, [libraryWidth])

  const startLibraryResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = libraryWidth
      const onMove = (moveEvent: PointerEvent) => {
        setLibraryWidth(
          clampNumber(startWidth + moveEvent.clientX - startX, 240, 480)
        )
      }
      const onUp = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [libraryWidth]
  )

  return (
    <div
      className="grid h-full min-h-0 gap-3 p-4"
      style={{
        gridTemplateColumns: `${libraryWidth}px 6px minmax(0, 1fr)`,
      }}
      data-slot="service-plan-workspace"
    >
      <ServicePlanLibraryPanel />
      <ResizeHandle
        axis="x"
        label="Resize service plan library"
        onPointerDown={startLibraryResize}
      />
      <div className="min-h-0 overflow-hidden rounded-lg border border-border bg-card">
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

export function ServicePlanDialog() {
  return <ServicePlanWorkspace />
}

export function ServicePlanPage() {
  return <ServicePlanWorkspace />
}

function LiveProductionGrid() {
  return (
    <div className="grid min-h-[360px] grid-cols-1 gap-3 xl:grid-cols-[300px_minmax(320px,1fr)_minmax(320px,1fr)_320px]">
      <TranscriptPanel />
      <PreviewPanel />
      <LiveOutputPanel />
      <QueuePanel />
    </div>
  )
}

export function RunServicePage() {
  const activePlan = useServicePlanStore((s) => s.activePlan)
  const serviceContext = useServicePlanStore((s) => s.serviceContext)
  const setActiveItem = useServicePlanStore((s) => s.setActiveItem)
  const deck = useHymnSlideStore((s) => s.deck)
  const hymnActiveIndex = useHymnSlideStore((s) => s.activeIndex)
  const sermonActiveIndex = useSermonSlideStore((s) => s.activeIndex)
  const previewItem = useBroadcastStore((s) => s.previewItem)
  const liveItem = useBroadcastStore((s) => s.isLive ? s.liveItem : null)
  const orderedItems = useMemo(
    () => [...(activePlan?.items ?? [])].sort((a, b) => a.order - b.order),
    [activePlan?.items],
  )
  const activeItem = useMemo(
    () =>
      activePlan?.items.find((item) => item.id === activePlan.activeItemId) ??
      null,
    [activePlan],
  )
  const slideDeck = useMemo(() => buildSermonSlideDeck(activeItem), [activeItem])
  const [timelineWidth, setTimelineWidth] = useState(
    () => loadDashboardLayoutState().liveServiceContextWidth,
  )

  useEffect(() => {
    const layout = loadDashboardLayoutState()
    if (layout.liveServiceContextWidth !== timelineWidth) {
      layout.liveServiceContextWidth = timelineWidth
      saveDashboardLayoutState(layout)
    }
  }, [timelineWidth])

  const startTimelineResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = timelineWidth
      const onMove = (moveEvent: PointerEvent) => {
        setTimelineWidth(
          clampNumber(startWidth - (moveEvent.clientX - startX), 280, 520),
        )
      }
      const onUp = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [timelineWidth],
  )

  const previewSlide = (index: number) => {
    const slide = slideDeck[index]
    if (!activeItem || !slide) return
    useSermonSlideStore.getState().setDeck(slideDeck, index, activeItem.id)
    selectPreviewItem(slide)
  }

  const presentSlide = (index: number) => {
    presentSermonSlideAt(index)
  }

  const previewHymn = (index: number) => {
    const slide = deck[index]
    if (!slide) return
    useHymnSlideStore.getState().setDeck(deck, index)
    selectPreviewItem(slide)
  }

  const presentHymn = (index: number) => {
    const slide = deck[index]
    if (!slide) return
    useHymnSlideStore.getState().setDeck(deck, index)
    presentItem(slide)
  }

  if (!activePlan) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        Load a service plan and start the service to use Run Service.
      </div>
    )
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-4"
      data-slot="run-service-page"
    >
      <ServiceLiveContextPanel />
      <LiveProductionGrid />

      <div
        className="grid min-h-0 flex-1 gap-3"
        style={{
          gridTemplateColumns: `minmax(0, 1fr) 6px ${timelineWidth}px`,
        }}
      >
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <PanelHeader title="Run Service" icon={<RadioIcon className="size-4" />}>
            <Badge variant="outline" className="text-[0.5625rem] uppercase">
              {activeItemContentLabel(activeItem)}
            </Badge>
            <Badge
              variant={serviceContext.performanceMode ? "default" : "outline"}
              className="text-[0.5625rem] uppercase"
            >
              {serviceContext.mode}
            </Badge>
          </PanelHeader>

          <div className="grid gap-4 border-b border-border p-4 md:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <div className="text-[0.625rem] font-medium text-muted-foreground uppercase">
                Current item
              </div>
              <div className="mt-1 text-lg font-semibold">
                {serviceContext.activeItem?.title ?? "Nothing active"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeItemContentLabel(activeItem ?? serviceContext.activeItem)}
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-[0.625rem] font-medium text-muted-foreground uppercase">
                Up next
              </div>
              <div className="mt-1 text-lg font-semibold">
                {serviceContext.nextItem?.title ?? "No next item"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeItemContentLabel(serviceContext.nextItem)}
              </p>
            </div>
          </div>

          {slideDeck.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
              <span className="text-xs font-medium text-muted-foreground">
                Sermon slides
              </span>
              <Button
                size="xs"
                variant="outline"
                disabled={sermonActiveIndex <= 0}
                onClick={() => previewSlide(Math.max(0, sermonActiveIndex - 1))}
              >
                Preview prev
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => previewSlide(sermonActiveIndex)}
              >
                Preview
              </Button>
              <Button size="xs" onClick={() => presentSlide(sermonActiveIndex)}>
                Go live
              </Button>
              <Button
                size="xs"
                variant="outline"
                disabled={sermonActiveIndex >= slideDeck.length - 1}
                onClick={() => previewSlide(sermonActiveIndex + 1)}
              >
                Preview next
              </Button>
            </div>
          )}

          {deck.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
              <span className="text-xs font-medium text-muted-foreground">
                Hymn deck
              </span>
              <Button
                size="xs"
                variant="outline"
                disabled={hymnActiveIndex <= 0}
                onClick={() => previewHymn(Math.max(0, hymnActiveIndex - 1))}
              >
                Preview prev
              </Button>
              <Button size="xs" variant="outline" onClick={() => previewHymn(hymnActiveIndex)}>
                Preview
              </Button>
              <Button size="xs" onClick={() => presentHymn(hymnActiveIndex)}>
                Go live
              </Button>
              <Button
                size="xs"
                variant="outline"
                disabled={hymnActiveIndex >= deck.length - 1}
                onClick={() => previewHymn(hymnActiveIndex + 1)}
              >
                Preview next
              </Button>
            </div>
          )}

          {(presentationDeckKind(previewItem) || presentationDeckKind(liveItem)) && (
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
              <span className="text-xs text-muted-foreground">Deck navigation</span>
              {previewItem && presentationDeckKind(previewItem) ? (
                <PresentationDeckControls
                  item={previewItem}
                  onNavigate={(kind, index) => {
                    if (kind === "hymn") previewHymn(index)
                    else previewSlide(index)
                  }}
                />
              ) : null}
            </div>
          )}
        </section>

        <ResizeHandle
          axis="x"
          label="Resize run service timeline"
          onPointerDown={startTimelineResize}
        />

        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <PanelHeader
            title="Service timeline"
            icon={<ClipboardListIcon className="size-4" />}
          />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <ServiceTimeline
              items={orderedItems}
              activeItemId={activePlan.activeItemId}
              performanceMode={serviceContext.performanceMode}
              onSelect={() => {}}
              onActivate={(itemId) => void setActiveItem(itemId)}
              onDuplicate={() => {}}
              onDelete={() => {}}
              onMarkReady={() => {}}
              onComplete={() => {}}
              onReorder={() => {}}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

export function LiveServicePlanPage() {
  const activePlan = useServicePlanStore((s) => s.activePlan)
  const serviceContext = useServicePlanStore((s) => s.serviceContext)
  const orderedItems = useMemo(
    () => [...(activePlan?.items ?? [])].sort((a, b) => a.order - b.order),
    [activePlan?.items]
  )
  const [contextWidth, setContextWidth] = useState(
    () => loadDashboardLayoutState().liveServiceContextWidth
  )

  useEffect(() => {
    const layout = loadDashboardLayoutState()
    if (layout.liveServiceContextWidth !== contextWidth) {
      layout.liveServiceContextWidth = contextWidth
      saveDashboardLayoutState(layout)
    }
  }, [contextWidth])

  const startContextResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = contextWidth
      const onMove = (moveEvent: PointerEvent) => {
        setContextWidth(
          clampNumber(startWidth - (moveEvent.clientX - startX), 240, 480)
        )
      }
      const onUp = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [contextWidth]
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-4">
      <LiveProductionGrid />

      <div
        className="grid min-h-0 flex-1 gap-3"
        style={{
          gridTemplateColumns: `minmax(0, 1fr) 6px ${contextWidth}px`,
        }}
      >
        <section className="min-h-0 overflow-hidden rounded-lg border border-border bg-card">
          <PanelHeader
            title="Live Service Plan"
            icon={<ClipboardListIcon className="size-4" />}
          >
            <Badge
              variant={serviceContext.performanceMode ? "default" : "outline"}
            >
              {serviceContext.planStatus}
            </Badge>
          </PanelHeader>
          <div className="grid gap-3 p-3 md:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <div className="text-[0.625rem] font-medium text-muted-foreground uppercase">
                Active item
              </div>
              <div className="mt-1 text-lg font-semibold">
                {serviceContext.activeItem?.title ?? "Nothing active"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground capitalize">
                {serviceContext.activeItem?.kind ??
                  "Start a service plan to populate this view"}
              </div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-[0.625rem] font-medium text-muted-foreground uppercase">
                Up next
              </div>
              <div className="mt-1 text-lg font-semibold">
                {serviceContext.nextItem?.title ?? "No next item"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground capitalize">
                {serviceContext.nextItem?.kind ?? "End of plan"}
              </div>
            </div>
          </div>
          <div className="min-h-0 px-3 pb-3">
            <div className="max-h-[calc(100vh-560px)] min-h-[180px] overflow-y-auto rounded-md border border-border">
              {orderedItems.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No service plan is loaded.
                </div>
              ) : (
                orderedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {item.title}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {item.kind}
                      </div>
                    </div>
                    <Badge
                      variant={item.status === "active" ? "default" : "outline"}
                    >
                      {item.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
        <ResizeHandle
          axis="x"
          label="Resize live service context panel"
          onPointerDown={startContextResize}
        />
        <section className="min-h-0 overflow-hidden rounded-lg border border-border bg-card">
          <PanelHeader
            title="Live Context"
            icon={<FileTextIcon className="size-4" />}
          />
          <div className="space-y-4 overflow-y-auto p-3 text-sm">
            <div>
              <div className="text-[0.625rem] font-medium text-muted-foreground uppercase">
                Expected references
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {serviceContext.expectedReferences.length > 0 ? (
                  serviceContext.expectedReferences.map((ref) => (
                    <Badge key={ref} variant="secondary">
                      {ref}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">
                    None for the active item.
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[0.625rem] font-medium text-muted-foreground uppercase">
                Operator notes
              </div>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                {serviceContext.operatorNotes ||
                  "No notes for the active item."}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export function LiveHymnPage() {
  const serviceContext = useServicePlanStore((s) => s.serviceContext)
  const deck = useHymnSlideStore((s) => s.deck)
  const activeIndex = useHymnSlideStore((s) => s.activeIndex)
  const activeSlide = deck[activeIndex] ?? null
  const [lyricsWidth, setLyricsWidth] = useState(
    () => loadDashboardLayoutState().liveHymnLyricsWidth
  )

  useEffect(() => {
    const layout = loadDashboardLayoutState()
    if (layout.liveHymnLyricsWidth !== lyricsWidth) {
      layout.liveHymnLyricsWidth = lyricsWidth
      saveDashboardLayoutState(layout)
    }
  }, [lyricsWidth])

  const startLyricsResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = lyricsWidth
      const onMove = (moveEvent: PointerEvent) => {
        setLyricsWidth(
          clampNumber(startWidth - (moveEvent.clientX - startX), 280, 520)
        )
      }
      const onUp = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [lyricsWidth]
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-4">
      <LiveProductionGrid />

      <div
        className="grid min-h-0 flex-1 gap-3"
        style={{
          gridTemplateColumns: `minmax(0, 1fr) 6px ${lyricsWidth}px`,
        }}
      >
        <section className="min-h-0 overflow-hidden rounded-lg border border-border bg-card">
          <PanelHeader
            title="Live Hymns"
            icon={<ListMusicIcon className="size-4" />}
          >
            <Badge variant="outline" className="tabular-nums">
              {deck.length > 0
                ? `${activeIndex + 1} of ${deck.length}`
                : "No deck"}
            </Badge>
          </PanelHeader>
          <div className="grid gap-3 p-3 md:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <div className="text-[0.625rem] font-medium text-muted-foreground uppercase">
                Current hymn slide
              </div>
              <div className="mt-1 text-lg font-semibold">
                {activeSlide?.hymnTitle ?? "No hymn live"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {activeSlide
                  ? `Hymn ${activeSlide.hymnNumber}`
                  : "Queue hymn slides to populate this page"}
              </div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-[0.625rem] font-medium text-muted-foreground uppercase">
                Service-plan hymns
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {serviceContext.hymnSummaries.length > 0 ? (
                  serviceContext.hymnSummaries.map((hymn) => (
                    <Badge key={hymn.hymnNumber} variant="secondary">
                      {hymn.hymnNumber} {hymn.title}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">
                    No active or next hymn refs.
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="min-h-0 px-3 pb-3">
            <div className="max-h-[calc(100vh-560px)] min-h-[180px] overflow-y-auto rounded-md border border-border">
              {deck.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No hymn slide deck is loaded.
                </div>
              ) : (
                deck.map((slide, index) => (
                  <div
                    key={slide.screenId}
                    className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {slide.reference}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {slide.hymnTitle}
                      </div>
                    </div>
                    <Badge
                      variant={index === activeIndex ? "default" : "outline"}
                    >
                      {index === activeIndex ? "live" : index + 1}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
        <ResizeHandle
          axis="x"
          label="Resize lyrics panel"
          onPointerDown={startLyricsResize}
        />
        <section className="min-h-0 overflow-hidden rounded-lg border border-border bg-card">
          <PanelHeader
            title="Current Lyrics"
            icon={<FileTextIcon className="size-4" />}
          />
          <div className="overflow-y-auto p-3">
            <p className="text-lg leading-8 whitespace-pre-wrap">
              {activeSlide?.segments
                .map((segment) => segment.text)
                .join("\n") || "No lyrics are currently selected."}
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

export function SermonSlidesPage() {
  const activePlan = useServicePlanStore((s) => s.activePlan)
  const updateItem = useServicePlanStore((s) => s.updateItem)
  const setActiveItem = useServicePlanStore((s) => s.setActiveItem)
  const openPlanner = useServicePlanStore((s) => s.openPlanner)
  const setWorkspace = useDashboardWorkspaceStore((s) => s.setWorkspace)
  const orderedItems = useMemo(
    () => [...(activePlan?.items ?? [])].sort((a, b) => a.order - b.order),
    [activePlan?.items]
  )
  const activeItem = useMemo(
    () =>
      activePlan?.items.find((item) => item.id === activePlan.activeItemId) ??
      null,
    [activePlan]
  )
  const slideAttachments = useMemo(
    () => activeItem?.attachments.filter((a) => a.kind === "slide") ?? [],
    [activeItem?.attachments]
  )
  const storedDeck = useSermonSlideStore((s) => s.deck)
  const storedIndex = useSermonSlideStore((s) => s.activeIndex)
  const themes = useBroadcastStore((s) => s.themes)
  const activeThemeId = useBroadcastStore((s) => s.activeThemeId)
  const activeTheme =
    themes.find((theme) => theme.id === activeThemeId) ?? themes[0]
  const deck = useMemo(() => buildSermonSlideDeck(activeItem), [activeItem])
  const activeIndex =
    storedDeck.length > 0 &&
    useSermonSlideStore.getState().activeItemId === activeItem?.id
      ? storedIndex
      : 0
  const activeSlide = deck[activeIndex] ?? deck[0] ?? null

  useEffect(() => {
    if (!activeItem) {
      useSermonSlideStore.getState().clear()
      return
    }
    void loadActiveSermonSlideDeck(activeIndex)
  }, [activeItem, activeIndex])

  const previewSlide = (index: number) => {
    const slide = deck[index]
    if (!activeItem || !slide) return
    useSermonSlideStore.getState().setDeck(deck, index, activeItem.id)
    selectPreviewItem(slide)
  }

  const presentSlide = (index: number) => {
    presentSermonSlideAt(index)
  }

  const handleSlidesChange = (slides: ServiceAttachment[]) => {
    if (!activeItem) return
    const others = activeItem.attachments.filter((a) => a.kind !== "slide")
    updateItem(activeItem.id, { attachments: [...slides, ...others] })
  }

  const [editorWidth, setEditorWidth] = useState(
    () => loadDashboardLayoutState().sermonSlidesEditorWidth
  )

  useEffect(() => {
    const layout = loadDashboardLayoutState()
    if (layout.sermonSlidesEditorWidth !== editorWidth) {
      layout.sermonSlidesEditorWidth = editorWidth
      saveDashboardLayoutState(layout)
    }
  }, [editorWidth])

  const startEditorResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = editorWidth
      const onMove = (moveEvent: PointerEvent) => {
        setEditorWidth(
          clampNumber(startWidth - (moveEvent.clientX - startX), 280, 520)
        )
      }
      const onUp = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [editorWidth]
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-3">
      <LiveProductionGrid />

      <div
        className="grid min-h-0 flex-1 gap-2"
        style={{
          gridTemplateColumns: `minmax(0, 1fr) 6px ${editorWidth}px`,
        }}
      >
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <PanelHeader
            title="Sermon Slides"
            icon={<ImagesIcon className="size-4" />}
          >
            <Badge variant="outline" className="tabular-nums">
              {deck.length > 0
                ? `${activeIndex + 1} of ${deck.length}`
                : "No slides"}
            </Badge>
          </PanelHeader>

          <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {activeItem?.title ?? "No active service item"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Voice: next slide, previous slide, slide 3
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="xs"
                variant="outline"
                disabled={!activeSlide || activeIndex === 0}
                onClick={() => presentSlide(activeIndex - 1)}
              >
                Previous
              </Button>
              <Button
                size="xs"
                variant="outline"
                disabled={!activeSlide}
                onClick={() => previewSlide(activeIndex)}
              >
                Preview
              </Button>
              <Button
                size="xs"
                disabled={!activeSlide}
                onClick={() => presentSlide(activeIndex)}
              >
                Live
              </Button>
              <Button
                size="xs"
                variant="outline"
                disabled={!activeSlide || activeIndex >= deck.length - 1}
                onClick={() => presentSlide(activeIndex + 1)}
              >
                Next
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center bg-black/80 p-4">
            {activeSlide ? (
              <CanvasPresentation
                theme={activeTheme}
                item={getPresentationRenderData(activeSlide)}
              />
            ) : (
              <div className="text-center text-sm text-muted-foreground">
                Upload sermon slides on the active Service Plan item.
              </div>
            )}
          </div>
        </section>

        <ResizeHandle
          axis="x"
          label="Resize slide editor panel"
          onPointerDown={startEditorResize}
        />

        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <PanelHeader
            title="Slide List"
            icon={<FileTextIcon className="size-4" />}
          />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-4 space-y-2 rounded-md border border-border p-3">
              <label
                htmlFor="sermon-slide-service-item"
                className="text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase"
              >
                Active service item
              </label>
              {orderedItems.length > 0 ? (
                <select
                  id="sermon-slide-service-item"
                  value={activeItem?.id ?? ""}
                  onChange={(event) =>
                    void setActiveItem(event.target.value || null)
                  }
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">Select an item</option>
                  {orderedItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Create a service-plan item before adding sermon slides.
                </p>
              )}
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  openPlanner()
                  setWorkspace("service-plans")
                }}
              >
                Open Service Plans
              </Button>
            </div>
            {!activeItem ? (
              <div className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
                No active service item. Select an item in the Service Plan to
                edit slides.
              </div>
            ) : (
              <SermonSlidesEditor
                attachments={slideAttachments}
                onChange={handleSlidesChange}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export const LazyServicePlanLibraryPanel = lazy(async () => ({
  default: ServicePlanLibraryPanel,
}))

export const LazyServicePlanWorkspace = lazy(async () => ({
  default: ServicePlanWorkspace,
}))

export const LazyServicePlanDialog = lazy(async () => ({
  default: ServicePlanDialog,
}))

export const LazyServicePlanPage = lazy(async () => ({
  default: ServicePlanPage,
}))
