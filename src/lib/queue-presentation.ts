import { presentItem, selectPreviewItem } from "@/lib/presentation-workflow"
import { restoreHymnDeckForQueueItem } from "@/lib/queued-hymn-deck"
import type { QueueItem } from "@/types"

export function previewQueuedItem(item: QueueItem): void {
  restoreHymnDeckForQueueItem(item)
  selectPreviewItem(item.presentation)
}

export function presentQueuedItem(item: QueueItem): void {
  restoreHymnDeckForQueueItem(item)
  presentItem(item.presentation)
}
