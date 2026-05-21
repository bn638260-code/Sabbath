import { useMemo, useRef, useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CanvasPresentation } from "@/components/ui/canvas-verse"
import { PanelHeader } from "@/components/ui/panel-header"
import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { Switch } from "@/components/ui/switch"
import { isPanelFullscreen, togglePanelFullscreen } from "@/components/panels/live-output-panel-fullscreen"
import { commitPreviewToLive } from "@/lib/presentation-workflow"
import { cn } from "@/lib/utils"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { EyeIcon, EyeOffIcon, RadioIcon, SendIcon, Maximize2Icon, Minimize2Icon } from "lucide-react"
import { toast } from "sonner"
import { ServiceLiveContextPanel } from "@/components/service-plan/ServiceLiveContextPanel"

export function LiveOutputPanel() {
  const isLive = useBroadcastStore((s) => s.isLive)
  const liveItem = useBroadcastStore((s) => s.liveItem)
  const readingModeAutoLive = useBroadcastStore((s) => s.readingModeAutoLive)
  const themes = useBroadcastStore((s) => s.themes)
  const activeThemeId = useBroadcastStore((s) => s.activeThemeId)
  const previewItem = useBroadcastStore((s) => s.previewItem)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const activeTheme = useMemo(
    () => themes.find((t) => t.id === activeThemeId) ?? themes[0],
    [themes, activeThemeId],
  )

  const visibleItem = useMemo(
    () => (isLive ? liveItem : null),
    [isLive, liveItem],
  )
  const canCommitPreview = Boolean(previewItem)

  const toggleFullscreen = async () => {
    const panel = panelRef.current
    if (!panel) return

    try {
      await togglePanelFullscreen(
        panel,
        document.fullscreenElement,
        () => document.exitFullscreen(),
      )
    } catch (error) {
      toast.error("Fullscreen failed", {
        description: String(error),
      })
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(isPanelFullscreen(panelRef.current, document.fullscreenElement))
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
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card",
        isLive && "shadow-[inset_0_2px_0_0_rgba(16,185,129,0.35)]",
        isFullscreen && "!rounded-none !border-0 !h-screen !w-screen",
      )}
    >
      {!isFullscreen && (
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

      <ServiceLiveContextPanel />

      <div className={cn("flex min-h-10 items-center justify-between gap-2 border-b border-border px-3 py-1.5", isFullscreen && "hidden")}>
        <Button
          size="sm"
          disabled={!canCommitPreview}
          className="gap-1.5"
          onClick={() => commitPreviewToLive()}
          title={
            canCommitPreview
              ? "Send the Program Preview verse to Live Output"
              : "Select a verse before sending live"
          }
        >
          <SendIcon className="size-3.5" />
          Send Preview Live
        </Button>

        <label className="flex items-center gap-2">
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

      <div className={cn("flex min-h-9 items-center justify-between gap-2 border-b border-border px-3 py-1.5", isFullscreen && "hidden")}>
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
          "flex min-h-0 flex-1 items-center justify-center p-3 transition-opacity",
          isFullscreen && "bg-black p-0",
          !isLive && "opacity-45",
        )}
      >
        {visibleItem ? (
          <CanvasPresentation
            theme={activeTheme}
            item={visibleItem}
            className={isFullscreen ? "[&_canvas]:rounded-none" : undefined}
          />
        ) : (
          <PanelEmptyState
            icon={<EyeOffIcon className="size-8" />}
            title="Nothing live"
            description="Send a verse or toggle visibility to show audience output."
          />
        )}
      </div>

      <div className={cn("truncate border-t border-border px-3 py-1.5 text-xs text-muted-foreground", isFullscreen && "hidden")}>
        {liveItem
          ? liveItem.reference
          : "Nothing has been sent to the live output yet."}
      </div>
    </div>
  )
}
