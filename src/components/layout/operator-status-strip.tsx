import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { LevelMeter } from "@/components/ui/level-meter"
import { cn } from "@/lib/utils"
import { useAudioStore } from "@/stores/audio-store"
import { useBibleStore } from "@/stores/bible-store"
import { selectActiveTheme, useBroadcastStore } from "@/stores/broadcast-store"
import { useQueueStore } from "@/stores/queue-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { useTranscriptStore } from "@/stores/transcript-store"
import { detectionActions } from "@/hooks/use-detection"
import { OperatorStatusActions } from "@/components/layout/operator-status-actions"
import { MicIcon, Rows3Icon, SwatchBookIcon } from "lucide-react"

export function OperatorStatusStrip({
  actionsLayout = "responsive",
}: {
  /** Force inline action buttons (used in tests). */
  actionsLayout?: "responsive" | "inline"
}) {
  const audioLevel = useAudioStore((s) => s.level)
  const isTranscribing = useTranscriptStore((s) => s.isTranscribing)
  const isLive = useBroadcastStore((s) => s.isLive)
  const liveItem = useBroadcastStore((s) => s.liveItem)
  const previewItem = useBroadcastStore((s) => s.previewItem)
  const readingModeAutoLive = useBroadcastStore((s) => s.readingModeAutoLive)
  const queueLength = useQueueStore((s) => s.items.length)
  const activeTheme = useBroadcastStore(selectActiveTheme)
  const selectedVerse = useBibleStore((s) => s.selectedVerse)
  const activePlan = useServicePlanStore((s) => s.activePlan)

  const [detectionPaused, setDetectionPaused] = useState(false)

  useEffect(() => {
    detectionActions
      .getDetectionControlStatus()
      .then((status) => setDetectionPaused(status.detection_paused))
      .catch((e) =>
        console.error("[operator-strip] detection control status failed", e)
      )
  }, [])

  const actionProps = {
    liveItem,
    previewItem,
    selectedVerse,
    readingModeAutoLive,
    detectionPaused,
    isLive,
    isTranscribing,
    onDetectionPausedChange: setDetectionPaused,
  }

  return (
    <section
      data-slot="operator-status-strip"
      className="flex h-11 shrink-0 items-center justify-between gap-4 overflow-x-auto border-b border-[rgba(255,255,255,0.06)] bg-slate-950/80 px-5 text-xs select-none scrollbar-thin"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
        <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
          <MicIcon className="size-3" />
          <LevelMeter level={audioLevel.rms} bars={5} />
          <span className="font-mono text-[10px]">
            {isTranscribing ? "Listening" : "Idle"}
          </span>
        </div>

        <div className="h-3.5 w-px shrink-0 bg-white/10" />

        <div className="flex min-w-0 shrink items-center gap-1">
          <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
            Program:
          </span>
          <span className="truncate text-[10px] font-semibold text-foreground">
            {activePlan?.title ?? "No plan"}
          </span>
        </div>

        <div className="h-3.5 w-px shrink-0 bg-white/10" />

        <div className="flex min-w-0 shrink items-center gap-1">
          <span className="font-mono text-[10px] text-muted-foreground">Live:</span>
          <span className="truncate font-mono text-[10px] font-bold text-[var(--accent)]">
            {liveItem?.reference ?? "—"}
          </span>
        </div>

        <div className="h-3.5 w-px shrink-0 bg-white/10" />

        <Badge
          variant={isLive ? "default" : "outline"}
          className={cn(
            "h-5 shrink-0 font-mono text-[0.5rem] uppercase",
            isLive && "bg-emerald-500 text-white hover:bg-emerald-500",
          )}
        >
          {isLive ? "On air" : "Hidden"}
        </Badge>

        <div className="hidden items-center gap-1 text-muted-foreground md:flex">
          <Rows3Icon className="size-3" />
          <span className="font-mono text-[10px]">{queueLength}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border border-white/5 bg-slate-900/60 px-2 py-0.5 font-mono text-[10px]">
          <span
            className={cn(
              "size-1.5 rounded-full",
              isLive ? "bg-emerald-500 animate-pulse" : "bg-red-500/80",
            )}
          />
          <span className="text-muted-foreground">Broadcast</span>
          <span className="font-semibold uppercase text-foreground">
            {isLive ? "On air" : "Standby"}
          </span>
        </div>

        <div className="hidden max-w-[100px] items-center gap-1 lg:flex">
          <SwatchBookIcon className="size-3 shrink-0 text-muted-foreground" />
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            {activeTheme?.name ?? "Theme"}
          </span>
        </div>

        {actionsLayout === "inline" ? (
          <OperatorStatusActions {...actionProps} layout="inline" />
        ) : (
          <>
            <div className="hidden 2xl:block">
              <OperatorStatusActions {...actionProps} layout="inline" />
            </div>
            <div className="2xl:hidden">
              <OperatorStatusActions {...actionProps} layout="menu" />
            </div>
          </>
        )}
      </div>
    </section>
  )
}
