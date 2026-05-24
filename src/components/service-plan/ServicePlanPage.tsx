import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react"
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
import { ServiceItemDetailsPanel } from "./ServiceItemDetailsPanel"
import { SermonSlidesEditor } from "./SermonSlidesEditor"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { CanvasPresentation } from "@/components/ui/canvas-verse"
import { selectPreviewItem } from "@/lib/presentation-workflow"
import { buildSermonSlideDeck } from "@/services/slides/sermon-slide-deck"
import { loadActiveSermonSlideDeck, presentSermonSlideAt } from "@/services/slides/sermon-slide-voice-control"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import { getPresentationRenderData } from "@/types"
import type { ServiceAttachment } from "@/types/service-plan"

export { ServiceLiveContextPanel } from "./ServiceLiveContextPanel"

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

  const selectedItem = useMemo(
    () =>
      activePlan?.items.find((item) => item.id === activePlan.activeItemId) ??
      null,
    [activePlan]
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

      <div className="border-b border-border px-3 py-2">
        <Input
          value={activePlan.title}
          onChange={(event) => updatePlanTitle(event.target.value)}
          className="h-8"
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="flex min-h-0 flex-col border-r border-border">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
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
          <div className="min-h-0 flex-1 p-2">
            <ServiceTimeline
              items={activePlan.items}
              activeItemId={activePlan.activeItemId}
              performanceMode={serviceContext.performanceMode}
              onSelect={(itemId) => void setActiveItem(itemId)}
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

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
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
        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
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
      <div className="space-y-3 overflow-y-auto p-3">
        <PanelHeader
          title="Service Plan"
          icon={<ClipboardListIcon className="size-4" />}
        />
        <ServicePlanSummaryWidget />
        <div className="grid gap-2">
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
    () => loadDashboardLayoutState().servicePlanLibraryWidth,
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
        setLibraryWidth(clampNumber(startWidth + moveEvent.clientX - startX, 240, 480))
      }
      const onUp = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [libraryWidth],
  )

  return (
    <div
      className="grid h-full min-h-0 gap-2 p-3"
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
            <LazyServicePlanEditor />
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
    <div className="grid min-h-[360px] grid-cols-1 gap-1.5 xl:grid-cols-[280px_minmax(300px,1fr)_minmax(300px,1fr)_300px]">
      <TranscriptPanel />
      <PreviewPanel />
      <LiveOutputPanel />
      <QueuePanel />
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
    () => loadDashboardLayoutState().liveServiceContextWidth,
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
        setContextWidth(clampNumber(startWidth - (moveEvent.clientX - startX), 240, 480))
      }
      const onUp = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [contextWidth],
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-3">
      <LiveProductionGrid />

      <div
        className="grid min-h-0 flex-1 gap-2"
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
    () => loadDashboardLayoutState().liveHymnLyricsWidth,
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
        setLyricsWidth(clampNumber(startWidth - (moveEvent.clientX - startX), 280, 520))
      }
      const onUp = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [lyricsWidth],
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-3">
      <LiveProductionGrid />

      <div
        className="grid min-h-0 flex-1 gap-2"
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
  const activeItem = useMemo(
    () =>
      activePlan?.items.find((item) => item.id === activePlan.activeItemId) ??
      null,
    [activePlan],
  )
  const slideAttachments = useMemo(
    () => activeItem?.attachments.filter((a) => a.kind === "slide") ?? [],
    [activeItem?.attachments],
  )
  const storedDeck = useSermonSlideStore((s) => s.deck)
  const storedIndex = useSermonSlideStore((s) => s.activeIndex)
  const themes = useBroadcastStore((s) => s.themes)
  const activeThemeId = useBroadcastStore((s) => s.activeThemeId)
  const activeTheme = themes.find((theme) => theme.id === activeThemeId) ?? themes[0]
  const deck = useMemo(() => buildSermonSlideDeck(activeItem), [activeItem])
  const activeIndex =
    storedDeck.length > 0 && useSermonSlideStore.getState().activeItemId === activeItem?.id
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
    () => loadDashboardLayoutState().sermonSlidesEditorWidth,
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
        setEditorWidth(clampNumber(startWidth - (moveEvent.clientX - startX), 280, 520))
      }
      const onUp = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [editorWidth],
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
          <PanelHeader title="Sermon Slides" icon={<ImagesIcon className="size-4" />}>
            <Badge variant="outline" className="tabular-nums">
              {deck.length > 0 ? `${activeIndex + 1} of ${deck.length}` : "No slides"}
            </Badge>
          </PanelHeader>

          <div className="flex min-h-10 items-center justify-between gap-2 border-b border-border px-3 py-1.5">
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

          <div className="flex min-h-0 flex-1 items-center justify-center bg-black/80 p-3">
            {activeSlide ? (
              <CanvasPresentation theme={activeTheme} item={getPresentationRenderData(activeSlide)} />
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
          <PanelHeader title="Slide List" icon={<FileTextIcon className="size-4" />} />
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {!activeItem ? (
              <div className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
                No active service item. Select an item in the Service Plan to edit slides.
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
