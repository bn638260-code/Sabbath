import { useMemo, useState } from "react"
import { DragDropProvider } from "@dnd-kit/react"
import { ListOrderedIcon, Rows3Icon, SirenIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { PanelHeader } from "@/components/ui/panel-header"
import { EmergencyLiveButton } from "@/components/queue/EmergencyLiveButton"
import {
  PresentationThumbnail,
  QueueSorterCard,
} from "@/components/queue/QueueSorterCard"
import { QueueSelectionToolbar } from "@/components/queue/QueueSelectionToolbar"
import {
  isPresentableLibraryAsset,
  libraryAssetToFirstPresentation,
} from "@/lib/library/library-presentation"
import { isPresentationNavigationEditableTarget } from "@/lib/presentation-panel-navigation"
import {
  applySelectionClick,
  computeDrop,
  emptySelection,
} from "@/lib/queue-selection"
import { useEmergencySlideStore } from "@/stores/emergency-slide-store"
import { useLibraryStore } from "@/stores/library-store"
import { useQueueStore } from "@/stores/queue-store"
import { type PresentationRenderData } from "@/types"
import type { LibraryAsset } from "@/types/library"

/** Narrow a drag source to the sortable fields we commit from. */
function hasSortableIndexes(
  source: unknown
): source is { index: number; initialIndex: number } {
  if (!source || typeof source !== "object") return false
  const s = source as Record<string, unknown>
  return typeof s.index === "number" && typeof s.initialIndex === "number"
}

function selectedAssetRenderData(
  asset: LibraryAsset | null
): PresentationRenderData | null {
  if (!asset) return null
  return libraryAssetToFirstPresentation(asset)?.renderData ?? null
}

function EmergencySlidePanel() {
  const assets = useLibraryStore((s) => s.assets)
  const selectedAssetId = useEmergencySlideStore((s) => s.selectedAssetId)
  const setSelectedAssetId = useEmergencySlideStore((s) => s.setSelectedAssetId)

  const presentableAssets = useMemo(
    () => assets.filter(isPresentableLibraryAsset),
    [assets]
  )
  const selectedAsset =
    presentableAssets.find((asset) => asset.id === selectedAssetId) ?? null
  const renderData = useMemo(
    () => selectedAssetRenderData(selectedAsset),
    [selectedAsset]
  )

  return (
    <section className="glass-panel flex min-h-0 flex-col overflow-hidden">
      <PanelHeader
        title="Emergency Slide"
        icon={<SirenIcon className="size-3" />}
      >
        <EmergencyLiveButton size="xs" />
      </PanelHeader>

      <div className="space-y-3 p-3">
        <select
          aria-label="Emergency slide asset"
          value={selectedAssetId}
          className="search-input h-9 w-full px-2 text-sm"
          onChange={(event) => setSelectedAssetId(event.currentTarget.value)}
        >
          <option value="">No emergency slide</option>
          {presentableAssets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.name} ({asset.type})
            </option>
          ))}
        </select>

        <div className="aspect-video overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)]">
          {renderData ? (
            <PresentationThumbnail renderData={renderData} />
          ) : (
            <PanelEmptyState
              icon={<SirenIcon className="size-8" />}
              title="No emergency item"
              description="Choose a presentable library asset."
            />
          )}
        </div>

        {selectedAsset ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {selectedAsset.name}
            </p>
            <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
              {selectedAsset.type}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function QueueWorkspace() {
  const items = useQueueStore((s) => s.items)
  const activeIndex = useQueueStore((s) => s.activeIndex)
  const [selection, setSelection] = useState(emptySelection())

  const orderedIds = useMemo(() => items.map((item) => item.id), [items])
  const visibleSelection = useMemo(() => {
    const present = new Set(orderedIds)
    const ids = selection.ids.filter((id) => present.has(id))
    const anchorId =
      selection.anchorId && present.has(selection.anchorId)
        ? selection.anchorId
        : null
    return { anchorId, ids }
  }, [orderedIds, selection])
  const selectedSet = useMemo(
    () => new Set(visibleSelection.ids),
    [visibleSelection.ids]
  )

  const handleSelectClick = (
    id: string,
    mods: { ctrl: boolean; shift: boolean }
  ) => {
    setSelection((current) =>
      applySelectionClick(current, orderedIds, id, mods)
    )
  }

  const clearSelection = () => setSelection(emptySelection())

  const deleteSelection = () => {
    if (visibleSelection.ids.length === 0) return
    useQueueStore.getState().removeItems(visibleSelection.ids)
    setSelection(emptySelection())
  }

  const handleDragEnd = (event: {
    operation: {
      source?: { id?: unknown } | null
      target?: { id?: unknown } | null
    }
    canceled: boolean
  }) => {
    if (event.canceled) return
    const source = event.operation.source
    const sourceId = source?.id
    if (typeof sourceId !== "string") return

    const targetId = event.operation.target?.id
    if (typeof targetId === "string" && targetId !== sourceId) {
      const drop = computeDrop(
        orderedIds,
        visibleSelection.ids,
        sourceId,
        targetId
      )
      if (drop) {
        useQueueStore.getState().moveItems(drop.movingIds, drop.insertAt)
        return
      }
    }

    // The sortable plugin reorders the DOM optimistically during the drag, so
    // a drop without a usable target (empty space, or onto the card's own
    // moved slot) must still commit the sortable's final index — otherwise the
    // DOM order and the store (and its position numbers) desync permanently.
    if (hasSortableIndexes(source) && source.initialIndex !== source.index) {
      const selected = new Set(visibleSelection.ids)
      const movingIds = selected.has(sourceId)
        ? orderedIds.filter((id) => selected.has(id))
        : [sourceId]
      const moving = new Set(movingIds)
      const remaining = orderedIds.filter((id) => !moving.has(id))
      const insertAt = Math.max(0, Math.min(source.index, remaining.length))
      useQueueStore.getState().moveItems(movingIds, insertAt)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isPresentationNavigationEditableTarget(event.target)) return
    if (event.key === "Delete" || event.key === "Backspace") {
      if (visibleSelection.ids.length === 0) return
      event.preventDefault()
      deleteSelection()
    } else if (event.key === "Escape") {
      clearSelection()
    }
  }

  return (
    <div className="view-pane grid grid-cols-12 gap-3">
      <section className="glass-panel col-span-12 flex min-h-[calc(100vh-136px)] flex-col overflow-hidden xl:col-span-8">
        <PanelHeader
          title="Queue"
          icon={<ListOrderedIcon className="size-3" />}
        >
          <div className="flex items-center gap-2">
            <QueueSelectionToolbar
              count={visibleSelection.ids.length}
              onDelete={deleteSelection}
              onClear={clearSelection}
            />
            <Badge variant="outline">{items.length}</Badge>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={items.length === 0}
              onClick={() => {
                useQueueStore.getState().clearQueue()
                clearSelection()
              }}
            >
              Clear all
            </Button>
          </div>
        </PanelHeader>

        <div
          className="min-h-0 flex-1 overflow-y-auto outline-none"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          {items.length === 0 ? (
            <div className="flex h-full min-h-80 items-center justify-center">
              <PanelEmptyState
                icon={<Rows3Icon className="size-8" />}
                title="Queue is empty"
                description="Detected and manually queued items appear here."
              />
            </div>
          ) : (
            <DragDropProvider onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 xl:grid-cols-4">
                {items.map((item, index) => (
                  <QueueSorterCard
                    key={item.id}
                    item={item}
                    index={index}
                    isActive={index === activeIndex}
                    isSelected={selectedSet.has(item.id)}
                    onSelectClick={handleSelectClick}
                  />
                ))}
              </div>
            </DragDropProvider>
          )}
        </div>
      </section>

      <div className="col-span-12 flex min-h-0 flex-col gap-3 xl:col-span-4">
        <EmergencySlidePanel />
      </div>
    </div>
  )
}
