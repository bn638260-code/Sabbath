import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Button } from "@/components/ui/button"
import { TransportBar } from "@/components/controls/transport-bar"
import { OperatorStatusStrip } from "@/components/layout/operator-status-strip"
import { TranscriptPanel } from "@/components/panels/transcript-panel"
import { PreviewPanel } from "@/components/panels/preview-panel"
import { LiveOutputPanel } from "@/components/panels/live-output-panel"
import { QueuePanel } from "@/components/panels/queue-panel"
import { SearchPanel } from "@/components/panels/search-panel"
import { DetectionsPanel } from "@/components/panels/detections-panel"
import {
  DASHBOARD_LAYOUT_PRESETS,
  clampNumber,
  type DashboardViewMode,
} from "@/lib/dashboard-layout"

function ResizeHandle({
  axis,
  onPointerDown,
}: {
  axis: "x" | "y"
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      onPointerDown={onPointerDown}
      className={
        axis === "x"
          ? "cursor-col-resize rounded-sm bg-border/40 transition-colors hover:bg-primary/50"
          : "cursor-row-resize rounded-sm bg-border/40 transition-colors hover:bg-primary/50"
      }
    />
  )
}

export function Dashboard() {
  const contentRef = useRef<HTMLDivElement>(null)
  const [viewMode, setViewMode] = useState<DashboardViewMode>("balanced")
  const [topHeightPercent, setTopHeightPercent] = useState(
    DASHBOARD_LAYOUT_PRESETS.balanced.topHeightPercent
  )
  const [transcriptWidth, setTranscriptWidth] = useState(
    DASHBOARD_LAYOUT_PRESETS.balanced.transcriptWidth
  )
  const [queueWidth, setQueueWidth] = useState(
    DASHBOARD_LAYOUT_PRESETS.balanced.queueWidth
  )
  const [detectionsWidth, setDetectionsWidth] = useState(
    DASHBOARD_LAYOUT_PRESETS.balanced.detectionsWidth
  )

  const applyViewMode = (mode: DashboardViewMode) => {
    const preset = DASHBOARD_LAYOUT_PRESETS[mode]
    setViewMode(mode)
    setTopHeightPercent(preset.topHeightPercent)
    setTranscriptWidth(preset.transcriptWidth)
    setQueueWidth(preset.queueWidth)
    setDetectionsWidth(preset.detectionsWidth)
  }

  const startTopResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const content = contentRef.current
    if (!content) return

    const rect = content.getBoundingClientRect()
    const onMove = (moveEvent: PointerEvent) => {
      const next = ((moveEvent.clientY - rect.top) / rect.height) * 100
      setTopHeightPercent(clampNumber(next, 34, 68))
    }
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }, [])

  const startTranscriptResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = transcriptWidth
    const onMove = (moveEvent: PointerEvent) => {
      setTranscriptWidth(clampNumber(startWidth + moveEvent.clientX - startX, 240, 520))
    }
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }, [transcriptWidth])

  const startQueueResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = queueWidth
    const onMove = (moveEvent: PointerEvent) => {
      setQueueWidth(clampNumber(startWidth - (moveEvent.clientX - startX), 240, 520))
    }
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }, [queueWidth])

  const startDetectionsResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = detectionsWidth
    const onMove = (moveEvent: PointerEvent) => {
      setDetectionsWidth(clampNumber(startWidth - (moveEvent.clientX - startX), 360, 760))
    }
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }, [detectionsWidth])

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <TransportBar />
      <OperatorStatusStrip />

      <div className="flex items-center gap-1 border-b border-border bg-card/60 px-3 py-1.5">
        {(["balanced", "broadcast", "study"] as const).map((mode) => (
          <Button
            key={mode}
            size="xs"
            variant={viewMode === mode ? "default" : "outline"}
            onClick={() => applyViewMode(mode)}
            className="capitalize"
          >
            {mode}
          </Button>
        ))}
        <span className="ml-2 text-xs text-muted-foreground">
          Drag the dividers to resize panels
        </span>
      </div>

      <div ref={contentRef} className="flex min-h-0 flex-1 flex-col gap-1.5 p-3">
        <div
          className="grid min-h-0 gap-1.5 *:min-h-0"
          style={{
            height: `${topHeightPercent}%`,
            gridTemplateColumns: `${transcriptWidth}px 6px minmax(280px, 1fr) minmax(280px, 1fr) 6px ${queueWidth}px`,
          }}
        >
          <TranscriptPanel />
          <ResizeHandle axis="x" onPointerDown={startTranscriptResize} />
          <PreviewPanel />
          <LiveOutputPanel />
          <ResizeHandle axis="x" onPointerDown={startQueueResize} />
          <QueuePanel />
        </div>

        <ResizeHandle axis="y" onPointerDown={startTopResize} />

        <div
          className="grid min-h-0 flex-1 gap-1.5"
          style={{
            gridTemplateColumns: `minmax(0, 1fr) 6px ${detectionsWidth}px`,
          }}
        >
          <SearchPanel />
          <ResizeHandle axis="x" onPointerDown={startDetectionsResize} />
          <DetectionsPanel />
        </div>
      </div>
    </div>
  )
}
