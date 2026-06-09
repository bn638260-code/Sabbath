import { useEffect, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PanelHeader } from "@/components/ui/panel-header"
import { CanvasPresentation } from "@/components/ui/canvas-verse"
import { buildSermonSlideDeck } from "@/services/slides/sermon-slide-deck"
import {
  loadActiveSermonSlideDeck,
  presentSermonSlideAt,
  previewSermonSlideAt,
} from "@/services/slides/sermon-slide-live"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import { getPresentationRenderData } from "@/types"
import type { ServiceAttachment } from "@/types/service-plan"
import { FileTextIcon, ImagesIcon } from "lucide-react"
import { LiveProductionGrid } from "./LiveProductionGrid"
import { SermonSlidesEditor } from "./SermonSlidesEditor"

export function SermonSlidesPage() {
  const activePlan = useServicePlanStore((s) => s.activePlan)
  const updateItem = useServicePlanStore((s) => s.updateItem)
  const setActiveItem = useServicePlanStore((s) => s.setActiveItem)
  const openPlanner = useServicePlanStore((s) => s.openPlanner)
  const setWorkspace = useDashboardWorkspaceStore((s) => s.setWorkspace)
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
  const slideAttachments = useMemo(
    () => activeItem?.attachments.filter((a) => a.kind === "slide") ?? [],
    [activeItem?.attachments],
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

  const handleSlidesChange = (slides: ServiceAttachment[]) => {
    if (!activeItem) return
    const others = activeItem.attachments.filter((a) => a.kind !== "slide")
    updateItem(activeItem.id, { attachments: [...slides, ...others] })
  }

  return (
    <div className="flex min-h-full flex-col gap-2 p-3">
      <LiveProductionGrid />

      <div className="grid min-h-[420px] grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="glass-panel relative flex min-h-[400px] flex-col overflow-hidden">
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

          <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-2">
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
                onClick={() => presentSermonSlideAt(activeIndex - 1)}
              >
                Previous
              </Button>
              <Button
                size="xs"
                variant="outline"
                disabled={!activeSlide}
                onClick={() => previewSermonSlideAt(activeIndex)}
              >
                Preview
              </Button>
              <Button
                size="xs"
                disabled={!activeSlide}
                onClick={() => presentSermonSlideAt(activeIndex)}
              >
                Live
              </Button>
              <Button
                size="xs"
                variant="outline"
                disabled={!activeSlide || activeIndex >= deck.length - 1}
                onClick={() => presentSermonSlideAt(activeIndex + 1)}
              >
                Next
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center bg-black/80 p-2">
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

        <section className="glass-panel relative flex min-h-[400px] flex-col overflow-hidden">
          <PanelHeader
            title="Slide List"
            icon={<FileTextIcon className="size-4" />}
          />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-4 space-y-2 rounded-md border border-white/10 bg-white/[0.03] p-3">
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
                  className="search-input h-8 w-full px-2 text-xs"
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
              <div className="rounded-md border border-dashed border-white/5 p-4 text-xs text-muted-foreground">
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
