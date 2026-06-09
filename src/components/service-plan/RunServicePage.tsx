import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PanelHeader } from "@/components/ui/panel-header"
import { PresentationDeckControls } from "@/components/panels/presentation-deck-controls"
import { activeItemContentLabel } from "@/lib/service-plan/active-item-content-label"
import { presentationDeckKind } from "@/lib/presentation-deck-navigation"
import { presentItem, selectPreviewItem } from "@/lib/presentation-workflow"
import { buildSermonSlideDeck } from "@/services/slides/sermon-slide-deck"
import {
  presentSermonSlideAt,
  previewSermonSlideAt,
} from "@/services/slides/sermon-slide-live"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import { ClipboardListIcon, RadioIcon } from "lucide-react"
import { LiveProductionGrid } from "./LiveProductionGrid"
import { ServiceLiveContextPanel } from "./ServiceLiveContextPanel"
import { ServiceTimeline } from "./ServiceTimeline"

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
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4"
      data-slot="run-service-page"
    >
      <ServiceLiveContextPanel />
      <LiveProductionGrid />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="glass-panel relative flex min-h-0 flex-col overflow-hidden">
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

          <div className="grid gap-4 border-b border-white/5 p-4 md:grid-cols-2">
            <div className="rounded-md border border-white/5 p-3">
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
            <div className="rounded-md border border-white/5 p-3">
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
            <div className="flex flex-wrap items-center gap-3 border-b border-white/5 px-4 py-3">
              <span className="text-xs font-medium text-muted-foreground">
                Sermon slides
              </span>
              <Button
                size="xs"
                variant="outline"
                disabled={sermonActiveIndex <= 0}
                onClick={() => previewSermonSlideAt(Math.max(0, sermonActiveIndex - 1))}
              >
                Preview prev
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => previewSermonSlideAt(sermonActiveIndex)}
              >
                Preview
              </Button>
              <Button size="xs" onClick={() => presentSermonSlideAt(sermonActiveIndex)}>
                Go live
              </Button>
              <Button
                size="xs"
                variant="outline"
                disabled={sermonActiveIndex >= slideDeck.length - 1}
                onClick={() => previewSermonSlideAt(sermonActiveIndex + 1)}
              >
                Preview next
              </Button>
            </div>
          )}

          {deck.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-white/5 px-4 py-3">
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
            <div className="flex flex-wrap items-center gap-3 border-b border-white/5 px-4 py-3">
              <span className="text-xs text-muted-foreground">Deck navigation</span>
              {previewItem && presentationDeckKind(previewItem) ? (
                <PresentationDeckControls
                  item={previewItem}
                  onNavigate={(kind, index) => {
                    if (kind === "hymn") previewHymn(index)
                    else previewSermonSlideAt(index)
                  }}
                />
              ) : null}
            </div>
          )}
        </section>

        <section className="glass-panel relative flex min-h-0 flex-col overflow-hidden">
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
