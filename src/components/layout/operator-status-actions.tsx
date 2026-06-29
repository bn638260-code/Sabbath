import {
  BellOffIcon,
  BellRingIcon,
  EyeOffIcon,
  MoreHorizontalIcon,
  PauseCircleIcon,
  QuoteIcon,
  SparklesIcon,
  StopCircleIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { getBroadcastLiveStore } from "@/stores/broadcast/live-store"
import { detectionActions } from "@/hooks/use-detection"
import { transcriptionActions } from "@/hooks/use-transcription"
import {
  clearLiveOutput,
  clearPreviewOutput,
  pauseReadingModeAutoLive,
} from "@/lib/operator-actions"

type OperatorStatusActionsProps = {
  liveItem: { reference: string } | null
  previewItem: unknown
  selectedVerse: unknown
  readingModeAutoLive: boolean
  detectionPaused: boolean
  explicitCitationsOnly: boolean
  isLive: boolean
  isTranscribing: boolean
  onDetectionPausedChange: (paused: boolean) => void
  onExplicitCitationsOnlyChange: (enabled: boolean) => void
  layout: "inline" | "menu"
}

export function OperatorStatusActions({
  liveItem,
  previewItem,
  selectedVerse,
  readingModeAutoLive,
  detectionPaused,
  explicitCitationsOnly,
  isLive,
  isTranscribing,
  onDetectionPausedChange,
  onExplicitCitationsOnlyChange,
  layout,
}: OperatorStatusActionsProps) {
  const toggleDetectionPaused = () => {
    const next = !detectionPaused
    detectionActions
      .setDetectionPaused(next)
      .then(() => onDetectionPausedChange(next))
      .catch((e) =>
        console.error("[operator-strip] toggle detection paused failed", e)
      )
  }

  const toggleExplicitCitationsOnly = () => {
    const next = !explicitCitationsOnly
    detectionActions
      .setExplicitCitationsOnly(next)
      .then(() => onExplicitCitationsOnlyChange(next))
      .catch((e) =>
        console.error(
          "[operator-strip] toggle explicit citations only failed",
          e
        )
      )
  }

  const stripActionClass = (
    enabled: boolean,
    tone: "amber" | "emerald" | "red"
  ) =>
    cn(
      "btn-action flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6rem] tracking-wider uppercase transition-colors",
      enabled
        ? tone === "emerald"
          ? "text-emerald-500 hover:bg-emerald-500/15 hover:text-emerald-400"
          : tone === "red"
            ? "text-red-500 hover:bg-red-500/15 hover:text-red-400"
            : "text-amber-500 hover:bg-amber-500/15 hover:text-amber-400"
        : "cursor-not-allowed text-muted-foreground/30"
    )

  const actions = [
    {
      key: "clear-live",
      label: "Clear live",
      icon: Trash2Icon,
      enabled: Boolean(liveItem),
      tone: "amber" as const,
      onClick: clearLiveOutput,
    },
    {
      key: "clear-preview",
      label: "Clear preview",
      icon: XIcon,
      enabled: Boolean(previewItem || selectedVerse),
      tone: "amber" as const,
      onClick: clearPreviewOutput,
    },
    {
      key: "pause-auto",
      label: "Pause auto-live",
      icon: PauseCircleIcon,
      enabled: readingModeAutoLive,
      tone: "amber" as const,
      onClick: pauseReadingModeAutoLive,
    },
    {
      key: "detection",
      label: detectionPaused ? "Resume suggestions" : "Pause suggestions",
      icon: detectionPaused ? BellRingIcon : BellOffIcon,
      enabled: true,
      tone: detectionPaused ? ("emerald" as const) : ("amber" as const),
      onClick: toggleDetectionPaused,
    },
    {
      key: "explicit-citations",
      label: explicitCitationsOnly ? "Allow paraphrases" : "Citations only",
      icon: explicitCitationsOnly ? SparklesIcon : QuoteIcon,
      enabled: true,
      tone: explicitCitationsOnly ? ("emerald" as const) : ("amber" as const),
      onClick: toggleExplicitCitationsOnly,
    },
    {
      key: "hide",
      label: "Hide live output",
      icon: EyeOffIcon,
      enabled: isLive,
      tone: "red" as const,
      onClick: () => getBroadcastLiveStore().setLive(false),
    },
    {
      key: "stop-mic",
      label: "Stop transcription",
      icon: StopCircleIcon,
      enabled: isTranscribing,
      tone: "red" as const,
      onClick: () => {
        void transcriptionActions.stop()
      },
    },
  ]

  if (layout === "menu") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="chrome"
            size="xs"
            className="btn-action gap-1 font-mono text-[10px] uppercase"
          >
            <MoreHorizontalIcon className="size-3.5" />
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.key}
              disabled={!action.enabled}
              onClick={action.onClick}
              className="gap-2 font-mono text-xs uppercase"
            >
              <action.icon className="size-3.5" />
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          disabled={!action.enabled}
          title={action.label}
          onClick={action.onClick}
          className={stripActionClass(action.enabled, action.tone)}
        >
          <action.icon className="size-3" />
          <span className="hidden 2xl:inline">{action.label}</span>
        </button>
      ))}
    </div>
  )
}
