import { presentItem, selectPreviewItem } from "@/lib/presentation-workflow"
import { restorePresentationDeckForQueueItem } from "@/lib/queued-presentation-deck"
import type { QueueItem } from "@/types"

export function previewQueuedItem(item: QueueItem): void {
  restorePresentationDeckForQueueItem(item)
  selectPreviewItem(item.presentation)
}

export function presentQueuedItem(item: QueueItem): void {
  restorePresentationDeckForQueueItem(item)
  presentItem(item.presentation)
}
