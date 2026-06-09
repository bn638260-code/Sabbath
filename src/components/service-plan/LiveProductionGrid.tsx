import { LiveOutputPanel } from "@/components/panels/live-output-panel"
import { PreviewPanel } from "@/components/panels/preview-panel"
import { QueuePanel } from "@/components/panels/queue-panel"
import { TranscriptPanel } from "@/components/panels/transcript-panel"

export function LiveProductionGrid() {
  return (
    <div className="grid min-h-[360px] grid-cols-1 gap-3 xl:min-h-[400px] xl:grid-cols-[280px_minmax(340px,0.9fr)_minmax(520px,1.35fr)_300px]">
      <TranscriptPanel />
      <PreviewPanel />
      <LiveOutputPanel />
      <QueuePanel />
    </div>
  )
}
