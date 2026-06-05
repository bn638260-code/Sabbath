import { useMemo, useRef, useState, useEffect } from "react"
import { flushSync } from "react-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CanvasPresentation } from "@/components/ui/canvas-verse"
import { PanelHeader } from "@/components/ui/panel-header"
import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { Switch } from "@/components/ui/switch"
import { isPanelFullscreen, togglePanelFullscreen } from "@/components/panels/live-output-panel-fullscreen"
import { commitPreviewToLive, presentItem } from "@/lib/presentation-workflow"
import { cn } from "@/lib/utils"
import { selectActiveTheme, useBroadcastStore } from "@/stores/broadcast-store"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import { PresentationDeckControls } from "@/components/panels/presentation-deck-controls"
import { presentationDeckKind } from "@/lib/presentation-deck-navigation"
import { EyeIcon, EyeOffIcon, RadioIcon, SendIcon, Maximize2Icon, Minimize2Icon } from "lucide-react"
import { toast } from "sonner"

export function LiveOutputPanel({ className }: { className?: string }) {
  const isLive = useBroadcastStore((s) => s.isLive)
  const liveItem = useBroadcastStore((s) => s.liveItem)
  const readingModeAutoLive = useBroadcastStore((s) => s.readingModeAutoLive)
  const activeTheme = useBroadcastStore(selectActiveTheme)
  const previewItem = useBroadcastStore((s) => s.previewItem)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isFullscreenLayout, setIsFullscreenLayout] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const visibleItem = useMemo(
    () => (isLive ? liveItem : null),
    [isLive, liveItem],
  )
  const canCommitPreview = Boolean(previewItem)
  const navigateLiveDeck = (kind: "hymn" | "slideDeck", index: number) => {
    if (kind === "hymn") {
      const hymnSlides = useHymnSlideStore.getState()
      const next = hymnSlides.deck[index]
      if (!next) return
      hymnSlides.setDeck(hymnSlides.deck, index)
      presentItem(next)
      return
    }
    const sermonSlides = useSermonSlideStore.getState()
    const next = sermonSlides.deck[index]
    if (!next) return
    sermonSlides.setDeck(sermonSlides.deck, index, sermonSlides.activeItemId)
    presentItem(next)
  }

  const toggleFullscreen = async () => {
    const panel = panelRef.current
    if (!panel) return

    const panelOwnsFullscreen = isPanelFullscreen(panel, document.fullscreenElement)

    try {
      if (!panelOwnsFullscreen) {
        flushSync(() => setIsFullscreenLayout(true))
      }

      await togglePanelFullscreen(
        panel,
        document.fullscreenElement,
        () => document.exitFullscreen(),
      )
    } catch (error) {
      if (!panelOwnsFullscreen) {
        setIsFullscreenLayout(false)
      }
      toast.error("Fullscreen failed", {
        description: String(error),
      })
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      const panelIsFullscreen = isPanelFullscreen(panelRef.current, document.fullscreenElement)
      setIsFullscreen(panelIsFullscreen)
      setIsFullscreenLayout(panelIsFullscreen)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  return (
    <div
      ref={panelRef}
      data-slot="live-output-panel"
      data-fullscreen-layout={isFullscreenLayout ? "true" : undefined}
      className={cn(
        "glass-panel relative flex min-h-0 flex-col overflow-hidden",
        isFullscreenLayout && "!h-screen !w-screen !rounded-none !border-0",
        className,
      )}
    >
      {!isFullscreenLayout && (
        <PanelHeader title="Live output" icon={<RadioIcon className="size-3" />} step={3}>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="xs"
              className="h-6 gap-1 px-2"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize2Icon className="size-3.5" />
              ) : (
                <Maximize2Icon className="size-3.5" />
              )}
            </Button>
            <Badge
              variant={isLive ? "default" : "outline"}
              className={cn(
                "h-5 text-[0.5625rem] uppercase",
                isLive && "bg-emerald-500 text-white hover:bg-emerald-500",
              )}
            >
              {isLive ? "On air" : "Hidden"}
            </Badge>
          </div>
        </PanelHeader>
      )}

      <div className={cn("flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-2", isFullscreenLayout && "hidden")}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={!canCommitPreview}
            className="gap-2"
            onClick={() => commitPreviewToLive()}
            title={
              canCommitPreview
                ? "Send the Program Preview item to Live Output"
                : "Select a verse, hymn, or song before sending live"
            }
          >
            <SendIcon className="size-3.5" />
            Send Preview Live
          </Button>
          {isLive && presentationDeckKind(liveItem) ? (
            <PresentationDeckControls
              item={liveItem}
              onNavigate={navigateLiveDeck}
            />
          ) : null}
        </div>

        <label className="flex items-center gap-2.5">
          {isLive ? (
            <EyeIcon className="size-3.5 text-emerald-500" />
          ) : (
            <EyeOffIcon className="size-3.5 text-muted-foreground" />
          )}
          <span className="text-xs text-muted-foreground">
            {isLive ? "Visible" : "Hidden"}
          </span>
          <Switch
            checked={isLive}
            onCheckedChange={(checked) =>
              useBroadcastStore.getState().setLive(checked)
            }
            className="data-[state=checked]:bg-emerald-500"
          />
        </label>
      </div>

      <div className={cn("flex min-h-10 items-center justify-between gap-3 border-b border-white/5 px-4 py-2", isFullscreenLayout && "hidden")}>
        <span className="truncate text-xs text-muted-foreground">
          Auto-live reading mode
        </span>
        <Switch
          checked={readingModeAutoLive}
          onCheckedChange={(checked) =>
            useBroadcastStore.getState().setReadingModeAutoLive(checked)
          }
          className="data-[state=checked]:bg-emerald-500"
        />
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 bg-slate-950/50 p-2 transition-opacity",
          isFullscreenLayout && "bg-black p-0",
          !isLive && "opacity-45",
        )}
      >
        <div
          className={cn(
            "flex h-full w-full items-center justify-center rounded-md border border-white/5 p-2 text-center",
            isLive && !isFullscreenLayout && "live-glowing-active",
            isFullscreenLayout && "rounded-none border-0 p-0",
          )}
        >
          {visibleItem && activeTheme ? (
            <CanvasPresentation
              theme={activeTheme}
              item={visibleItem}
              className={isFullscreenLayout ? "[&_canvas]:rounded-none" : undefined}
            />
          ) : (
            <PanelEmptyState
              icon={<EyeOffIcon className="size-8" />}
              title="Nothing live"
              description="Send a verse, hymn, or song slide to show audience output."
            />
          )}
        </div>
      </div>

      <div className={cn("truncate border-t border-white/5 px-4 py-2 text-xs text-muted-foreground", isFullscreenLayout && "hidden")}>
        {liveItem
          ? liveItem.reference
          : "Nothing has been sent to the live output yet."}
      </div>
    </div>
  )
}
