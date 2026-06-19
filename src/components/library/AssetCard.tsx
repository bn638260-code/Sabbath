import {
  FolderPlusIcon,
  PlayIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { libraryAssetToServiceItem } from "@/lib/library/asset-to-service-item"
import { videoAssetToPresentation } from "@/lib/library/library-video"
import { songDocToDeck } from "@/lib/library/song-doc"
import { createHymnDeckQueueItems } from "@/services/hymnal/hymn-presentation"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useLibraryStore } from "@/stores/library-store"
import { useQueueStore } from "@/stores/queue-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import type { LibraryAsset } from "@/types/library"
import type { PresentationItem, PresentationRenderData } from "@/types"

interface AssetCardProps {
  asset: LibraryAsset
}

export function AssetCard({ asset }: AssetCardProps) {
  const collections = useLibraryStore((state) => state.collections)
  const deleteAsset = useLibraryStore((state) => state.deleteAsset)
  const addAssetToCollection = useLibraryStore(
    (state) => state.addAssetToCollection
  )
  const addItem = useServicePlanStore((state) => state.addItem)

  const preview = () => previewAsset(asset)
  const queue = () => queueAsset(asset)
  const applyTheme = () => {
    if (asset.type !== "theme") return
    const broadcast = useBroadcastStore.getState()
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

function previewAsset(asset: LibraryAsset): void {
  if (asset.type === "theme") return
  const item = firstPresentation(asset)
  if (!item) return
  useBroadcastStore.getState().setPreviewItem(item.renderData)
}

function queueAsset(asset: LibraryAsset): void {
  if (asset.type === "song") {
    const deck = songDocToDeck(asset.song)
    if (deck.length === 0) return
    useQueueStore.getState().addItems(
      createHymnDeckQueueItems(deck, {
        groupId: `library-song-${asset.id}-${crypto.randomUUID()}`,
        groupLabel: `${asset.name} - ${deck.length} slides`,
        source: "manual",
        idPrefix: `library-song-${asset.id}`,
      })
    )
    useHymnSlideStore.getState().setDeck(deck, 0)
    return
  }

  const item = firstPresentation(asset)
  if (!item) return
  useQueueStore.getState().addItem({
    id: crypto.randomUUID(),
    presentation: item.presentation,
    confidence: 1,
    source: "manual",
    added_at: Date.now(),
  })
}

function firstPresentation(asset: LibraryAsset): {
  presentation: PresentationItem
  renderData: PresentationRenderData
} | null {
  if (asset.type === "image") {
    const presentation: PresentationItem = {
      kind: "slideDeck",
      deckId: asset.id,
      deckTitle: asset.name,
      slideId: asset.id,
      slideIndex: 0,
      slideCount: 1,
      slidePath: asset.thumbnail ?? asset.fileName,
      reference: asset.name,
      segments: [{ text: asset.name }],
    }
    return {
      presentation,
      renderData: {
        kind: "slideDeck",
        reference: asset.name,
        segments: [{ text: asset.name }],
        slideImageUrl: asset.thumbnail ?? asset.fileName,
        hymnSlide: {
          screenId: asset.id,
          slideIndex: 0,
          slideCount: 1,
        },
      },
    }
  }

  if (asset.type === "song") {
    const deck = songDocToDeck(asset.song)
    const first = deck[0]
    if (!first) return null
    useHymnSlideStore.getState().setDeck(deck, 0)
    return {
      presentation: first,
      renderData: {
        kind: "hymn",
        reference: first.reference,
        segments: first.segments,
        hymnSlide: {
          screenId: first.screenId,
          slideIndex: first.slideIndex,
          slideCount: first.slideCount,
        },
      },
    }
  }

  if (asset.type === "slide-template") {
    const first = asset.deck[0]
    if (!first) return null
    return {
      presentation: first,
      renderData: {
        kind: "slideDeck",
        reference: first.reference,
        segments: first.segments,
        slideImageUrl: first.slidePath,
        hymnSlide: {
          screenId: first.slideId,
          slideIndex: first.slideIndex,
          slideCount: first.slideCount,
        },
      },
    }
  }

  if (asset.type === "video") {
    const presentation = videoAssetToPresentation(asset)
    return {
      presentation,
      renderData: {
        kind: "video",
        reference: asset.name,
        segments: [{ text: asset.name }],
        video: {
          source: asset.source,
          videoId: asset.id,
          title: asset.name,
          videoPath: asset.filePath,
          url: asset.url,
          youtubeId: asset.youtubeId,
          poster: asset.thumbnail,
          durationMs: asset.durationMs,
          width: asset.width,
          height: asset.height,
          mimeType: asset.mimeType,
        },
      },
    }
  }

  return null
}
