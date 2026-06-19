import { useState } from "react"
import { PanelHeader } from "@/components/ui/panel-header"
import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  EyeIcon,
  PlayIcon,
  XIcon,
  GripVerticalIcon,
  ListOrderedIcon,
  Rows3Icon,
  VideoIcon,
} from "lucide-react"
import { useQueueStore } from "@/stores/queue-store"
import { presentQueuedItem, previewQueuedItem } from "@/lib/queue-presentation"
import { getReferenceFromItem, type QueueItem } from "@/types"

function QueueItemRow({
  item,
  index,
  isActive,
  isHighlighted,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
}: {
  item: QueueItem
  index: number
  isActive: boolean
  isHighlighted: boolean
  isDragging: boolean
  isDropTarget: boolean
  onDragStart: (index: number) => void
  onDragEnter: (index: number) => void
  onDragEnd: () => void
  onDrop: (index: number) => void
}) {
  const handlePreview = () => {
    useQueueStore.getState().setActive(index)
    previewQueuedItem(item)
  }

  const handlePresent = () => {
    useQueueStore.getState().setActive(index)
    presentQueuedItem(item)
  }

  const handleRemove = () => {
    useQueueStore.getState().removeItem(item.id)
  }

  const sourceBadge =
    item.source === "service-plan" ? (
      <Badge className="shrink-0 bg-violet-500/15 text-[0.5rem] text-violet-300 hover:bg-violet-500/15">
        Plan
      </Badge>
    ) : item.source === "manual" ? (
      <Badge variant="outline" className="shrink-0 text-[0.5rem]">
        Manual
      </Badge>
    ) : item.source === "hymn" ? (
      <Badge className="shrink-0 bg-amber-500/15 text-[0.5rem] text-amber-300 hover:bg-amber-500/15">
        Hymn
      </Badge>
    ) : item.source === "ai-semantic" ? (
      <Badge className="shrink-0 bg-indigo-500/15 text-[0.5rem] text-indigo-300 hover:bg-indigo-500/15">
        Semantic
      </Badge>
    ) : (
      <Badge className="shrink-0 bg-green-500/15 text-[0.5rem] text-green-600 hover:bg-green-500/15">
        Direct
      </Badge>
    )

  return (
    <div
      data-queue-idx={index}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData("text/plain", String(index))
        onDragStart(index)
      }}
      onDragEnter={(event) => {
        event.preventDefault()
        onDragEnter(index)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = "move"
      }}
      onDragEnd={onDragEnd}
      onDrop={(event) => {
        event.preventDefault()
        onDrop(index)
      }}
      className={cn(
        "queue-item group flex w-full cursor-grab items-center justify-between p-3 text-left active:cursor-grabbing",
        isDragging && "opacity-50",
        isDropTarget && "ring-1 ring-primary/60",
        isHighlighted
          ? "animate-pulse border border-amber-500/40 bg-amber-500/15"
          : isActive
            ? "border border-primary/30 bg-primary/10"
            : "hover:bg-[var(--shell-bg-sunken)]"
      )}
    >
      <GripVerticalIcon
        aria-hidden
        className="size-3 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100"
      />

      <span className="flex-1 truncate text-sm font-medium text-foreground">
        {item.presentation.kind === "video" ? (
          <VideoIcon className="mr-1 inline size-3 text-muted-foreground" />
        ) : null}
        {getReferenceFromItem(item)}
      </span>

      {sourceBadge}

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handlePreview}
          title="Preview"
        >
          <EyeIcon className="size-2.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handlePresent}
          title="Present live"
        >
          <PlayIcon className="size-2.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleRemove}
          title="Remove"
        >
          <XIcon className="size-2.5" />
        </Button>
      </div>
    </div>
  )
}

export function QueuePanel({ className }: { className?: string }) {
  const items = useQueueStore((s) => s.items)
  const activeIndex = useQueueStore((s) => s.activeIndex)
  const highlightedId = useQueueStore((s) => s.highlightedId)
  const highlightedIds = useQueueStore((s) => s.highlightedIds)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)

  const resetDragState = () => {
    setDraggedIndex(null)
    setDropTargetIndex(null)
  }

  const handleDrop = (toIndex: number) => {
    if (draggedIndex !== null && draggedIndex !== toIndex) {
      useQueueStore.getState().reorderItems(draggedIndex, toIndex)
    }
    resetDragState()
  }

  return (
    <div
      data-slot="queue-panel"
      className={cn(
        "glass-panel relative flex min-h-0 flex-col overflow-hidden",
        className
      )}
    >
      <PanelHeader
        title="Queue"
        icon={<ListOrderedIcon className="size-3" />}
        step={4}
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline">{items.length}</Badge>
          <button
            onClick={() => useQueueStore.getState().clearQueue()}
            className="text-[0.625rem] text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      </PanelHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0.5 p-1.5">
          {items.length === 0 && (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <PanelEmptyState
                icon={<Rows3Icon className="size-8" />}
                title="Queue is empty"
                description="Verses will appear here when detected or manually queued."
              />
            </div>
          )}
          {items.map((item, idx) => {
            const showGroupLabel =
              item.hymnGroup && item.hymnGroup.itemIndex === 1
            const prevItem = idx > 0 ? items[idx - 1] : null
            const isDifferentGroup =
              !prevItem ||
              prevItem.hymnGroup?.groupId !== item.hymnGroup?.groupId

            return (
              <div key={item.id}>
                {showGroupLabel && isDifferentGroup && item.hymnGroup && (
                  <div className="px-2.5 py-1 text-[0.625rem] font-medium text-muted-foreground">
                    {item.hymnGroup.groupLabel}
                  </div>
                )}
                <QueueItemRow
                  item={item}
                  index={idx}
                  isActive={idx === activeIndex}
                  isHighlighted={
                    highlightedIds.length > 0
                      ? highlightedIds.includes(item.id)
                      : item.id === highlightedId
                  }
                  isDragging={idx === draggedIndex}
                  isDropTarget={idx === dropTargetIndex && idx !== draggedIndex}
                  onDragStart={setDraggedIndex}
                  onDragEnter={setDropTargetIndex}
                  onDragEnd={resetDragState}
                  onDrop={handleDrop}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
