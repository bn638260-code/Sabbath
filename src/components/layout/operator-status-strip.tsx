import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { LevelMeter } from "@/components/ui/level-meter"
import { cn } from "@/lib/utils"
import { useAudioStore } from "@/stores/audio-store"
import { useBibleStore } from "@/stores/bible-store"
import { useBroadcastLiveStore } from "@/stores/broadcast/live-store"
import {
  selectActiveTheme,
  useBroadcastThemeStore,
} from "@/stores/broadcast/theme-store"
import {
  selectLatestOutputIssue,
  useBroadcastOutputIssueStore,
} from "@/stores/broadcast/output-issue-store"
import { useQueueStore } from "@/stores/queue-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { useTranscriptStore } from "@/stores/transcript-store"
import { useVerificationStore } from "@/stores/verification-store"
import { detectionActions } from "@/hooks/use-detection"
import { OperatorStatusActions } from "@/components/layout/operator-status-actions"
import {
  AlertTriangleIcon,
  MicIcon,
  Rows3Icon,
  SwatchBookIcon,
} from "lucide-react"

// Isolate the high-frequency `audio_level` tick (many times per second while
// recording) to this leaf so it doesn't re-render the whole status strip and
// its action buttons. Subscribing to the `rms` primitive also skips ticks where
// only `peak` changed.
function MicLevelMeter() {
  const rms = useAudioStore((s) => s.level.rms)
  return <LevelMeter level={rms} bars={5} />
}

function ChurchOrganizationBadge({
  isChurchOrganization,
  churchName,
}: {
  isChurchOrganization: boolean
  churchName: string | null
}) {
  if (!isChurchOrganization || !churchName) return null

  return (
    <Badge
      className="h-5 max-w-[180px] shrink-0 rounded-md border-emerald-500/30 bg-emerald-500/15 font-mono text-[0.5rem] text-emerald-700 uppercase hover:bg-emerald-500/15 dark:text-emerald-300"
      title={"Self-declared church organization: " + churchName}
      variant="outline"
    >
      <span className="truncate">Church · {churchName}</span>
    </Badge>
  )
}

export function OperatorStatusStrip({
  actionsLayout = "responsive",
}: {
  /** Force inline action buttons (used in tests). */
  actionsLayout?: "responsive" | "inline"
}) {
  const isTranscribing = useTranscriptStore((s) => s.isTranscribing)
  const isLive = useBroadcastLiveStore((s) => s.isLive)
  const liveItem = useBroadcastLiveStore((s) => s.liveItem)
  const previewItem = useBroadcastLiveStore((s) => s.previewItem)
  const readingModeAutoLive = useBroadcastLiveStore(
    (s) => s.readingModeAutoLive
  )
  const queueLength = useQueueStore((s) => s.items.length)
  const activeTheme = useBroadcastThemeStore(selectActiveTheme)
  const selectedVerse = useBibleStore((s) => s.selectedVerse)
  const activePlan = useServicePlanStore((s) => s.activePlan)
  const latestOutputIssue = useBroadcastOutputIssueStore(
    selectLatestOutputIssue
  )
  const isChurchOrganization = useVerificationStore(
    (state) => state.isChurchOrganization
  )
  const churchName = useVerificationStore((state) => state.churchName)

  const [detectionPaused, setDetectionPaused] = useState(false)

  const outputIssueLabel =
    latestOutputIssue?.outputId === "alt"
      ? "Alt"
      : latestOutputIssue?.outputId === "main"
        ? "Main"
        : "Output"

  useEffect(() => {
    detectionActions
      .getDetectionControlStatus()
      .then((status) => {
        setDetectionPaused(status.detection_paused)
      })
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
      className="mx-3 mt-2 flex h-12 shrink-0 scrollbar-thin items-center justify-between gap-4 overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--shell-bg-elevated)_55%,transparent)] px-4 text-xs shadow-[var(--shell-panel-shadow)] backdrop-blur-xl select-none"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
        <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
          <MicIcon className="size-3" />
          <MicLevelMeter />
          <span className="font-mono text-[10px]">
            {isTranscribing ? "Listening" : "Idle"}
          </span>
        </div>

        <div className="h-3.5 w-px shrink-0 bg-[var(--shell-bg-sunken)]" />

        <div className="flex min-w-0 shrink items-center gap-1">
          <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
            Program:
          </span>
          <span className="truncate text-[10px] font-semibold text-foreground">
            {activePlan?.title ?? "No plan"}
          </span>
        </div>

        <div className="h-3.5 w-px shrink-0 bg-[var(--shell-bg-sunken)]" />

        <div className="flex min-w-0 shrink items-center gap-1">
          <span className="font-mono text-[10px] text-muted-foreground">
            Live:
          </span>
          <span className="truncate font-mono text-[10px] font-bold text-[var(--accent)]">
            {liveItem?.reference ?? "—"}
          </span>
        </div>

        <div className="h-3.5 w-px shrink-0 bg-[var(--shell-bg-sunken)]" />

        <Badge
          variant={isLive ? "default" : "outline"}
          className={cn(
            "h-5 shrink-0 rounded-md font-mono text-[0.5rem] uppercase",
            isLive &&
              "border-red-500/30 bg-red-500/15 text-red-700 hover:bg-red-500/15 dark:text-red-300"
          )}
        >
          {isLive ? "On air" : "Hidden"}
        </Badge>

        <ChurchOrganizationBadge
          churchName={churchName}
          isChurchOrganization={isChurchOrganization}
        />

        <div className="hidden items-center gap-1 text-muted-foreground md:flex">
          <Rows3Icon className="size-3" />
          <span className="font-mono text-[10px]">{queueLength}</span>
        </div>

        {latestOutputIssue ? (
          <>
            <div className="h-3.5 w-px shrink-0 bg-[var(--shell-bg-sunken)]" />
            <button
              type="button"
              title={latestOutputIssue.description}
              onClick={() =>
                useBroadcastOutputIssueStore
                  .getState()
                  .clearOutputIssue(latestOutputIssue.id)
              }
              className="flex max-w-[180px] shrink-0 items-center gap-1 rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-700 dark:text-red-300"
            >
              <AlertTriangleIcon className="size-3 shrink-0" />
              <span className="truncate font-mono">
                {outputIssueLabel}: {latestOutputIssue.title}
              </span>
            </button>
          </>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)] px-2 py-0.5 font-mono text-[10px]">
          <span
            className={cn(
              "size-1.5 rounded-full",
              isLive
                ? "animate-pulse bg-red-400"
                : "bg-muted-foreground/60"
            )}
          />
          <span className="text-muted-foreground">Broadcast</span>
          <span className="font-semibold text-foreground uppercase">
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
