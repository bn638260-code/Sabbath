import {
  FolderPlusIcon,
  PlayIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { libraryAssetToServiceItem } from "@/lib/library/asset-to-service-item"
import {
  previewLibraryAsset,
  queueLibraryAsset,
} from "@/lib/library/library-presentation"
import { useBroadcastThemeStore } from "@/stores/broadcast/theme-store"
import { useLibraryStore } from "@/stores/library-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import type { LibraryAsset } from "@/types/library"

interface AssetCardProps {
  asset: LibraryAsset
}

export function AssetCard({ asset }: AssetCardProps) {
  const collections = useLibraryStore((state) => state.collections)
  const deleteAsset = useLibraryStore((state) => state.deleteAsset)
  const updateAsset = useLibraryStore((state) => state.updateAsset)
  const addAssetToCollection = useLibraryStore(
    (state) => state.addAssetToCollection
  )
  const addItem = useServicePlanStore((state) => state.addItem)

  const preview = () => previewLibraryAsset(asset)
  const queue = () => queueLibraryAsset(asset)
  const applyTheme = () => {
    if (asset.type !== "theme") return
    const broadcast = useBroadcastThemeStore.getState()
    broadcast.saveTheme({ ...asset.theme, builtin: false })
    broadcast.setActiveTheme(asset.theme.id)
  }
  const videoMissing =
    asset.type === "video" &&
    ((asset.source === "local" && !asset.filePath) ||
      (asset.source === "url" && !asset.url) ||
      (asset.source === "youtube" && !asset.youtubeId))

  const unlinkedCollection = collections.find(
    (collection) => !asset.collectionIds.includes(collection.id)
  )

  return (
    <article
      className="group flex min-h-64 flex-col overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
      draggable={asset.type === "image"}
      onDragStart={(event) => {
        if (asset.type !== "image") return
        event.dataTransfer.setData(
          "application/x-sabbathcue-library-image",
          JSON.stringify({
            fileName: asset.fileName,
            thumbnail: asset.thumbnail,
            name: asset.name,
          })
        )
        event.dataTransfer.effectAllowed = "copy"
      }}
    >
      <div className="flex aspect-video items-center justify-center bg-[var(--shell-bg-sunken)]">
        {asset.thumbnail ? (
          <img
            src={asset.thumbnail}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-center text-xs font-semibold text-muted-foreground uppercase">
            {videoMissing ? "Missing source" : asset.type}
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {asset.name}
          </p>
          <p className="mt-1 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
            {asset.type}
          </p>
        </div>

        {asset.type === "slide-template" ? (
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <input
              type="checkbox"
              checked={asset.applyTheme ?? false}
              onChange={(event) =>
                updateAsset(asset.id, { applyTheme: event.target.checked })
              }
              className="h-3 w-3 rounded border-input accent-primary"
            />
            Apply current theme to these slides
          </label>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-1.5">
          {asset.type === "theme" ? (
            <Button type="button" size="xs" onClick={applyTheme}>
              <PlayIcon className="size-3" />
              Apply
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={preview}
                disabled={videoMissing}
              >
                <SendIcon className="size-3" />
                Preview
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={queue}
                disabled={videoMissing}
              >
                <PlusIcon className="size-3" />
                Queue
              </Button>
            </>
          )}
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => addItem(libraryAssetToServiceItem(asset))}
          >
            Plan
          </Button>
          {unlinkedCollection ? (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              title={`Add to ${unlinkedCollection.name}`}
              onClick={() =>
                addAssetToCollection(asset.id, unlinkedCollection.id)
              }
            >
              <FolderPlusIcon className="size-3" />
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            title="Delete asset"
            onClick={() => deleteAsset(asset.id)}
          >
            <Trash2Icon className="size-3" />
          </Button>
        </div>
      </div>
    </article>
  )
}
