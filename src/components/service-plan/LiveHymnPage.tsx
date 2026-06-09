import { Badge } from "@/components/ui/badge"
import { PanelHeader } from "@/components/ui/panel-header"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { FileTextIcon, ListMusicIcon } from "lucide-react"
import { LiveProductionGrid } from "./LiveProductionGrid"

export function LiveHymnPage() {
  const serviceContext = useServicePlanStore((s) => s.serviceContext)
  const deck = useHymnSlideStore((s) => s.deck)
  const activeIndex = useHymnSlideStore((s) => s.activeIndex)
  const activeSlide = deck[activeIndex] ?? null

  return (
    <div className="flex min-h-full flex-col gap-3 p-4">
      <LiveProductionGrid />

      <div className="grid min-h-[380px] grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="glass-panel relative flex min-h-[360px] flex-col overflow-hidden">
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
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-4 shadow-inner shadow-black/20">
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
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-4 shadow-inner shadow-black/20">
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
          <div className="flex min-h-0 flex-1 px-3 pb-3">
            <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-white/10 bg-black/20">
              {deck.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No hymn slide deck is loaded.
                </div>
              ) : (
                deck.map((slide, index) => (
                  <div
                    key={slide.screenId}
                    className="flex items-center justify-between gap-3 border-b border-white/5 px-3 py-2 last:border-b-0"
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
        <section className="glass-panel relative flex min-h-[360px] flex-col overflow-hidden">
          <PanelHeader
            title="Current Lyrics"
            icon={<FileTextIcon className="size-4" />}
          />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
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
