import { useMemo, useRef, useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CanvasPresentation } from "@/components/ui/canvas-verse"
import { VideoControlBar } from "@/components/broadcast/VideoControlBar"
import { PanelHeader } from "@/components/ui/panel-header"
import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Switch } from "@/components/ui/switch"
import {
  applyPanelFullscreen,
  tauriWindowFullscreen,
} from "@/components/panels/live-output-panel-fullscreen"
import { commitPreviewToLive, presentItem } from "@/lib/presentation-workflow"
import { cn } from "@/lib/utils"
import { selectActiveTheme, useBroadcastStore } from "@/stores/broadcast-store"
import { useEgwSlideStore } from "@/stores/egw-slide-store"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import { PresentationDeckControls } from "@/components/panels/presentation-deck-controls"
import { presentationDeckKind } from "@/lib/presentation-deck-navigation"
import {
  EyeIcon,
  EyeOffIcon,
  RadioIcon,
  SendIcon,
  Maximize2Icon,
  Minimize2Icon,
} from "lucide-react"
import { toast } from "sonner"
import type { BroadcastTransitionType } from "@/types"

const LIVE_TRANSITION_OPTIONS: { value: BroadcastTransitionType; label: string }[] = [
  { value: "none", label: "Cut" },
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Slide" },
  { value: "scale", label: "Scale" },
]

export function LiveOutputPanel({ className }: { className?: string }) {
  const isLive = useBroadcastStore((s) => s.isLive)
  const liveItem = useBroadcastStore((s) => s.liveItem)
  const readingModeAutoLive = useBroadcastStore((s) => s.readingModeAutoLive)
  const liveTransitionType = useBroadcastStore((s) => s.liveTransitionType)
  const activeTheme = useBroadcastStore(selectActiveTheme)
  const previewItem = useBroadcastStore((s) => s.previewItem)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isFullscreenLayout, setIsFullscreenLayout] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const visibleItem = useMemo(
    () => (isLive ? liveItem : null),
    [isLive, liveItem]
  )
  const canCommitPreview = Boolean(previewItem)
  const navigateLiveDeck = (
    kind: "hymn" | "slideDeck" | "egw",
    index: number
  ) => {
    if (kind === "hymn") {
      const hymnSlides = useHymnSlideStore.getState()
      const next = hymnSlides.deck[index]
      if (!next) return
      hymnSlides.setDeck(hymnSlides.deck, index)
      presentItem(next)
      return
    }
    if (kind === "egw") {
      const egwSlides = useEgwSlideStore.getState()
      const next = egwSlides.deck[index]
      if (!next) return
      egwSlides.setDeck(egwSlides.deck, index)
      presentItem(next)
      return
    }
    const sermonSlides = useSermonSlideStore.getState()
    const next = sermonSlides.deck[index]
    if (!next) return
    sermonSlides.setDeck(sermonSlides.deck, index, sermonSlides.activeItemId)
    presentItem(next)
  }

  const setPanelFullscreen = async (fullscreen: boolean) => {
    try {
      await applyPanelFullscreen(
        fullscreen,
        { setFullscreen: tauriWindowFullscreen },
        (next) => {
          setIsFullscreen(next)
          setIsFullscreenLayout(next)
        }
      )
    } catch (error) {
      toast.error("Fullscreen failed", {
        description: String(error),
      })
    }
  }

  const toggleFullscreen = () => setPanelFullscreen(!isFullscreen)

  // Window fullscreen has no built-in Escape handling (unlike the HTML5
  // Fullscreen API), so restore it here.
  useEffect(() => {
    if (!isFullscreenLayout) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      void setPanelFullscreen(false)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isFullscreenLayout])

  return (
    <div
      ref={panelRef}
      data-slot="live-output-panel"
      data-fullscreen-layout={isFullscreenLayout ? "true" : undefined}
      className={cn(
        "glass-panel relative flex min-h-0 flex-col overflow-hidden",
        isFullscreenLayout &&
          "!fixed !inset-0 !z-[80] !h-screen !w-screen !rounded-none !border-0",
        className
      )}
    >
      <PanelHeader
        title="Live output"
        icon={<RadioIcon className="size-3" />}
        step={3}
        className={cn(isFullscreenLayout && "hidden")}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="xs"
            className="h-6 gap-1 px-2"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
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
              isLive && "bg-emerald-500 text-foreground hover:bg-emerald-500"
            )}
          >
            {isLive ? "On air" : "Hidden"}
          </Badge>
        </div>
      </PanelHeader>

      <div
        className={cn(
          "flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-2",
          isFullscreenLayout && "hidden"
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            aria-label="Live transition"
            value={liveTransitionType}
            options={LIVE_TRANSITION_OPTIONS}
            onChange={(type) =>
              useBroadcastStore.getState().setLiveTransitionType(type)
            }
            className="[&_button]:px-2"
          />
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

      <div
        className={cn(
          "flex min-h-10 items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-2",
          isFullscreenLayout && "hidden"
        )}
      >
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

      {isLive && liveItem?.kind === "video" ? (
        <VideoControlBar item={liveItem} />
      ) : null}

      <div
        data-slot="live-output-stage"
        className={cn(
          "flex min-h-0 flex-1 bg-[var(--shell-bg-sunken)] p-2",
          isFullscreenLayout && "bg-black p-0",
          !isFullscreenLayout && !isLive && "opacity-45 transition-opacity"
        )}
      >
        <div
          data-slot="live-output-frame"
          className={cn(
            "flex h-full w-full items-center justify-center rounded-md border border-[var(--border-subtle)] p-2 text-center",
            isLive && !isFullscreenLayout && "live-glowing-active",
            isFullscreenLayout && "rounded-none border-0 p-0"
          )}
        >
          {visibleItem && activeTheme ? (
            <CanvasPresentation
              theme={activeTheme}
              item={visibleItem}
              className={
                isFullscreenLayout ? "[&_canvas]:rounded-none" : undefined
              }
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

      <div
        className={cn(
          "truncate border-t border-[var(--border-subtle)] px-4 py-2 text-xs text-muted-foreground",
          isFullscreenLayout && "hidden"
        )}
      >
        {liveItem
          ? liveItem.reference
          : "Nothing has been sent to the live output yet."}
      </div>
    </div>
  )
}
