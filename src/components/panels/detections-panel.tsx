import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { PanelHeader } from "@/components/ui/panel-header"
import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { ConfidenceDot } from "@/components/ui/confidence-dot"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  BrainCircuitIcon,
  EyeIcon,
  PlayIcon,
  PlusIcon,
  RadarIcon,
} from "lucide-react"
import { useDetection, detectionActions } from "@/hooks/use-detection"
import { useSettingsStore } from "@/stores/settings-store"
import { useQueueStore } from "@/stores/queue-store"
import {
  detectionToVerse,
  presentVerse,
  selectPreviewVerse,
  createScriptureQueueItem,
  previewEgwParagraph,
  presentEgwParagraph,
  createEgwQueueItem,
} from "@/lib/presentation-workflow"
import { AUTO_PREVIEW_MIN_CONFIDENCE } from "@/lib/verse-detection-workflow"
import { loadHymnVoiceControl } from "@/services/hymnal/hymn-voice-control-loader"
import type {
  DetectionResult,
  EgwParagraph,
  HymnDetection,
  Verse,
} from "@/types"

const SOURCE_COLORS: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  direct: { bg: "bg-green-500/15", text: "text-green-600", label: "Direct" },
  semantic: {
    bg: "bg-indigo-500/15",
    text: "text-indigo-300",
    label: "Semantic",
  },
  hymn: { bg: "bg-amber-500/15", text: "text-amber-300", label: "Hymn" },
}

function SourceBadge({ source }: { source: string }) {
  const style = SOURCE_COLORS[source] ?? {
    bg: "bg-[var(--shell-bg-sunken)]",
    text: "text-muted-foreground",
    label: source,
  }
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[0.5625rem] font-medium tracking-wider uppercase ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  )
}

function isEgwDetection(
  detection: DetectionResult
): detection is DetectionResult & { egw_paragraph: EgwParagraph } {
  return detection.content_type === "egw" && Boolean(detection.egw_paragraph)
}

function isHymnDetection(
  detection: DetectionResult
): detection is DetectionResult & { hymn: HymnDetection } {
  return detection.content_type === "hymn" && Boolean(detection.hymn)
}

function HymnDetectionCard({
  detection,
}: {
  detection: DetectionResult & { hymn: HymnDetection }
}) {
  const { number, title } = detection.hymn

  return (
    <div className="queue-item p-3 last:border-0">
      <div className="flex items-center gap-2">
        <ConfidenceDot confidence={detection.confidence} />
        <span className="text-xs font-medium text-muted-foreground">
          {Math.round(detection.confidence * 100)}%
        </span>
        <SourceBadge source="hymn" />
        <span className="text-sm font-semibold text-foreground">
          {detection.verse_ref}
        </span>
      </div>

      {title && (
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {title}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() =>
            void loadHymnVoiceControl().then((mod) =>
              mod.previewHymnByNumber(number)
            )
          }
        >
          <EyeIcon className="size-3" />
          Preview
        </Button>
        <Button
          size="sm"
          className="gap-1"
          onClick={() =>
            void loadHymnVoiceControl().then((mod) =>
              mod.presentHymnByNumber(number)
            )
          }
        >
          <PlayIcon className="size-3" />
          Present
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() =>
            void loadHymnVoiceControl().then((mod) =>
              mod.queueHymnByNumber(number)
            )
          }
        >
          <PlusIcon className="size-3" />
          Queue
        </Button>
      </div>
    </div>
  )
}

function DetectionCard({ detection }: { detection: DetectionResult }) {
  if (isHymnDetection(detection)) {
    return <HymnDetectionCard detection={detection} />
  }

  const egwParagraph = isEgwDetection(detection)
    ? detection.egw_paragraph
    : null
  const verse: Verse | null = egwParagraph ? null : detectionToVerse(detection)

  const handlePreview = () => {
    if (egwParagraph) {
      previewEgwParagraph(egwParagraph)
    } else if (verse) {
      selectPreviewVerse(verse)
    }
  }

  const handlePresent = () => {
    if (egwParagraph) {
      presentEgwParagraph(egwParagraph)
    } else if (verse) {
      presentVerse(verse)
    }
  }

  return (
    <div className="queue-item p-3 last:border-0">
      <div className="flex items-center gap-2">
        <ConfidenceDot confidence={detection.confidence} />
        <span className="text-xs font-medium text-muted-foreground">
          {Math.round(detection.confidence * 100)}%
        </span>
        <SourceBadge source={detection.source} />
        <span className="text-sm font-semibold text-foreground">
          {detection.verse_ref}
        </span>
      </div>

      {detection.verse_text && (
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {detection.verse_text}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={handlePreview}
        >
          <EyeIcon className="size-3" />
          Preview
        </Button>
        <Button size="sm" className="gap-1" onClick={handlePresent}>
          <PlayIcon className="size-3" />
          Present
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => {
            if (egwParagraph) {
              useQueueStore.getState().addOrFlashItem(
                createEgwQueueItem(egwParagraph, {
                  confidence: detection.confidence,
                  source: "ai-direct",
                })
              )
              return
            }
            if (verse) {
              useQueueStore.getState().addOrFlashItem(
                createScriptureQueueItem(verse, {
                  reference: detection.verse_ref,
                  confidence: detection.confidence,
                  source:
                    detection.source === "direct" ? "ai-direct" : "ai-semantic",
                })
              )
            }
          }}
        >
          <PlusIcon className="size-3" />
          Queue
        </Button>
      </div>
    </div>
  )
}

export function DetectionsPanel({ className }: { className?: string }) {
  const { detections } = useDetection()
  const confidenceThreshold = useSettingsStore((s) => s.confidenceThreshold)
  const autoPreviewDetections = useSettingsStore((s) => s.autoPreviewDetections)
  const [semanticStatus, setSemanticStatus] = useState<{
    has_semantic: boolean
    paraphrase_enabled: boolean
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    detectionActions
      .getDetectionStatus()
      .then((status) => {
        if (!cancelled) {
          setSemanticStatus({
            has_semantic: status.has_semantic,
            paraphrase_enabled: status.paraphrase_enabled,
          })
        }
      })
      .catch((e) => console.error("[detections] status fetch failed", e))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div
      data-slot="detections-panel"
      className={cn(
        "glass-panel relative flex min-h-0 flex-col overflow-hidden",
        className
      )}
    >
      <PanelHeader
        title="Recent detections"
        icon={<RadarIcon className="size-3" />}
        step={6}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label
            className="inline-flex items-center gap-1.5 rounded border border-[var(--border-subtle)] px-1.5 py-0.5 text-[0.5625rem] text-muted-foreground uppercase"
            title="When on, only direct detections at 85% or higher stage themselves automatically."
          >
            <EyeIcon className="size-2.5" />
            Auto preview {Math.round(AUTO_PREVIEW_MIN_CONFIDENCE * 100)}%+
            <Switch
              aria-label="Auto preview detections"
              checked={autoPreviewDetections}
              onCheckedChange={(checked) =>
                useSettingsStore.getState().setAutoPreviewDetections(checked)
              }
            />
          </label>
          <span
            className="inline-flex items-center gap-1 rounded border border-[var(--border-subtle)] px-1.5 py-0.5 text-[0.5625rem] text-muted-foreground uppercase"
            title="Semantic detections remain visible from 63%; the threshold controls automatic output only."
          >
            <BrainCircuitIcon className="size-2.5" />
            {semanticStatus?.has_semantic ? "Semantic" : "Keyword"}
            {semanticStatus?.paraphrase_enabled
              ? " + paraphrase"
              : ""} auto {Math.round(confidenceThreshold * 100)}%
          </span>
          <button
            onClick={() => detectionActions.clearDetections()}
            className="text-[0.625rem] text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      </PanelHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0">
          {detections.length === 0 && (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <PanelEmptyState
                icon={<RadarIcon className="size-8" />}
                title="No detections yet"
                description="Verse detections will appear here during live transcription."
              />
            </div>
          )}
          {detections.map((detection, i) => (
            <DetectionCard
              key={`${detection.verse_ref}-${i}`}
              detection={detection}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
