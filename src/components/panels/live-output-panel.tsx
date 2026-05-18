import { PanelHeader } from "@/components/ui/panel-header"
import { CanvasVerse } from "@/components/ui/canvas-verse"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { useBroadcastStore } from "@/stores"

export function LiveOutputPanel() {
  const isLive = useBroadcastStore((s) => s.isLive)
  const liveVerse = useBroadcastStore((s) => s.liveVerse)
  const themes = useBroadcastStore((s) => s.themes)
  const activeThemeId = useBroadcastStore((s) => s.activeThemeId)

  const activeTheme = themes.find((t) => t.id === activeThemeId) ?? themes[0]
  const visibleVerse = isLive ? liveVerse : null

  return (
    <div
      data-slot="live-output-panel"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card",
        isLive && "shadow-[inset_0_2px_0_0_rgba(16,185,129,0.3)]"
      )}
    >
      <PanelHeader title="Live display">
        <label className="flex items-center gap-2">
          <span
            className={cn(
              "text-[0.625rem] font-medium uppercase tracking-wider transition-colors",
              isLive ? "text-emerald-400" : "text-muted-foreground"
            )}
          >
            {isLive ? "Live" : "Go live"}
          </span>
          <Switch
            checked={isLive}
            onCheckedChange={(checked) =>
              useBroadcastStore.getState().setLive(checked)
            }
            className="data-[state=checked]:bg-emerald-500"
          />
        </label>
      </PanelHeader>

      <div
        className={cn(
          "flex min-h-0 flex-1 items-center justify-center p-3 transition-opacity",
          !isLive && "opacity-40"
        )}
      >
        <CanvasVerse theme={activeTheme} verse={visibleVerse} />
      </div>
    </div>
  )
}
