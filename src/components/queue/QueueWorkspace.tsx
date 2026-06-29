import { useMemo } from "react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  ListOrderedIcon,
  PlayIcon,
  Rows3Icon,
  SirenIcon,
  Trash2Icon,
  VideoIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CanvasPresentation } from "@/components/ui/canvas-verse"
import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { PanelHeader } from "@/components/ui/panel-header"
import { EmergencyLiveButton } from "@/components/queue/EmergencyLiveButton"
import {
  isPresentableLibraryAsset,
  libraryAssetToFirstPresentation,
} from "@/lib/library/library-presentation"
import { presentQueuedItem, previewQueuedItem } from "@/lib/queue-presentation"
import { cn } from "@/lib/utils"
import { usePresentationItemTheme } from "@/stores/broadcast/theme-store"
import { useEmergencySlideStore } from "@/stores/emergency-slide-store"
import { useLibraryStore } from "@/stores/library-store"
import { useQueueStore } from "@/stores/queue-store"
import {
  getPresentationRenderData,
  getReferenceFromItem,
  type PresentationItem,
  type PresentationRenderData,
  type QueueItem,
} from "@/types"
import type { LibraryAsset } from "@/types/library"

function kindLabel(kind: PresentationItem["kind"]): string {
  if (kind === "slideDeck") return "Slide"
  if (kind === "egw") return "Ellen White"
  return kind
}

function slideLabel(item: PresentationItem): string | null {
  if (
    item.kind === "hymn" ||
    item.kind === "slideDeck" ||
    item.kind === "egw"
  ) {
    return `Slide ${item.slideIndex + 1}/${item.slideCount}`
  }
  return null
}

function sourceLabel(source: QueueItem["source"]): string {
  if (source === "service-plan") return "Plan"
  if (source === "ai-direct") return "Direct"
  if (source === "ai-semantic") return "Semantic"
  if (source === "ai-cloud") return "Cloud"
  return source
}

function PresentationThumbnail({
  renderData,
  className,
}: {
  renderData: PresentationRenderData | null
  className?: string
}) {
  const activeTheme = usePresentationItemTheme(renderData)

  if (renderData?.kind === "video") {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center overflow-hidden bg-black",
          className
        )}
      >
        {renderData.video?.poster ? (
          <img
            src={renderData.video.poster}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <VideoIcon className="size-8 text-muted-foreground" />
        )}
      </div>
    )
  }

  if (renderData?.kind === "slideDeck" && renderData.slideImageUrl) {
    return (
      <img
        src={renderData.slideImageUrl}
        alt=""
        className={cn("h-full w-full object-contain", className)}
        loading="lazy"
      />
    )
  }

  if (activeTheme && renderData) {
    return (
      <CanvasPresentation
        theme={activeTheme}
        item={renderData}
        className={cn("[&_canvas]:rounded-sm", className)}
      />
    )
  }

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center text-xs text-muted-foreground",
        className
      )}
    >
      Preview
    </div>
  )
}

function QueueDetailCard({
  item,
  index,
  isActive,
  canMoveUp,
  canMoveDown,
}: {
  item: QueueItem
  index: number
  isActive: boolean
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  const renderData = useMemo(
    () => getPresentationRenderData(item.presentation),
    [item.presentation]
  )
  const label = slideLabel(item.presentation)

  const preview = () => {
    useQueueStore.getState().setActive(index)
    previewQueuedItem(item)
  }
  const present = () => {
    useQueueStore.getState().setActive(index)
    presentQueuedItem(item)
  }

  return (
    <article
      className={cn(
        "grid gap-3 border-b border-[var(--border-subtle)] p-3 md:grid-cols-[8rem_minmax(0,1fr)_auto]",
        isActive && "bg-[var(--accent-glow)]"
      )}
    >
      <div className="aspect-video overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)]">
        <PresentationThumbnail renderData={renderData} />
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={isActive ? "default" : "outline"}>
            {String(index + 1).padStart(2, "0")}
          </Badge>
          <Badge variant="outline">{kindLabel(item.presentation.kind)}</Badge>
          <Badge variant="outline">{sourceLabel(item.source)}</Badge>
          {label ? <Badge variant="outline">{label}</Badge> : null}
        </div>
        <p className="truncate text-sm font-semibold text-foreground">
          {getReferenceFromItem(item)}
        </p>
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {renderData.segments.map((segment) => segment.text).join(" ")}
        </p>
      </div>

      <div className="flex items-center gap-1 md:flex-col md:justify-center">
        <Button
          type="button"
          size="icon-xs"
          variant="outline"
          title="Preview"
          onClick={preview}
        >
          <EyeIcon className="size-3" />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          title="Send live"
          onClick={present}
        >
          <PlayIcon className="size-3" />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          title="Move up"
          disabled={!canMoveUp}
          onClick={() => useQueueStore.getState().reorderItems(index, index - 1)}
        >
          <ArrowUpIcon className="size-3" />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          title="Move down"
          disabled={!canMoveDown}
          onClick={() => useQueueStore.getState().reorderItems(index, index + 1)}
        >
          <ArrowDownIcon className="size-3" />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          title="Remove"
          onClick={() => useQueueStore.getState().removeItem(item.id)}
        >
          <Trash2Icon className="size-3" />
        </Button>
      </div>
    </article>
  )
}

function selectedAssetRenderData(asset: LibraryAsset | null): PresentationRenderData | null {
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
      <PanelHeader title="Emergency Slide" icon={<SirenIcon className="size-3" />}>
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

  return (
    <div className="view-pane grid grid-cols-12 gap-3">
      <section className="glass-panel col-span-12 flex min-h-[calc(100vh-136px)] flex-col overflow-hidden xl:col-span-8">
        <PanelHeader title="Queue" icon={<ListOrderedIcon className="size-3" />}>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{items.length}</Badge>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={items.length === 0}
              onClick={() => useQueueStore.getState().clearQueue()}
            >
              Clear all
            </Button>
          </div>
        </PanelHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex h-full min-h-80 items-center justify-center">
              <PanelEmptyState
                icon={<Rows3Icon className="size-8" />}
                title="Queue is empty"
                description="Detected and manually queued items appear here."
              />
            </div>
          ) : (
            items.map((item, index) => (
              <QueueDetailCard
                key={item.id}
                item={item}
                index={index}
                isActive={index === activeIndex}
                canMoveUp={index > 0}
                canMoveDown={index < items.length - 1}
              />
            ))
          )}
        </div>
      </section>

      <div className="col-span-12 flex min-h-0 flex-col gap-3 xl:col-span-4">
        <EmergencySlidePanel />
      </div>
    </div>
  )
}
