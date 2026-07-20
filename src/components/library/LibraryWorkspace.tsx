import { useMemo, useState } from "react"
import { FolderInputIcon, LibraryIcon, PlusIcon } from "lucide-react"
import { AddAssetMenu } from "@/components/library/AddAssetMenu"
import { AssetGrid } from "@/components/library/AssetGrid"
import {
  CollectionSidebar,
  type LibraryFilter,
} from "@/components/library/CollectionSidebar"
import { SongEditor } from "@/components/library/SongEditor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PanelHeader } from "@/components/ui/panel-header"
import {
  collectionAssets,
  libraryAssetToServiceItem,
} from "@/lib/library/asset-to-service-item"
import { sortLibraryAssetsByImportOrder } from "@/lib/library/library-order"
import {
  isPresentableLibraryAsset,
  queueLibraryAssetsInImportOrder,
  queueLibraryAssetsInPickOrder,
} from "@/lib/library/library-presentation"
import {
  pruneOrderedSelection,
  toggleOrderedSelection,
} from "@/lib/library/ordered-selection"
import { useLibraryStore } from "@/stores/library-store"
import { useServicePlanStore } from "@/stores/service-plan-store"

export function LibraryWorkspace() {
  const assets = useLibraryStore((state) => state.assets)
  const collections = useLibraryStore((state) => state.collections)
  const addItem = useServicePlanStore((state) => state.addItem)
  const [filter, setFilter] = useState<LibraryFilter>("all")
  const [query, setQuery] = useState("")
  const [songEditorOpen, setSongEditorOpen] = useState(false)
  const [pickedIds, setPickedIds] = useState<string[]>([])

  // Picks survive filter/search changes but not asset deletion.
  const activePickedIds = useMemo(
    () =>
      pruneOrderedSelection(pickedIds, new Set(assets.map((a) => a.id))),
    [assets, pickedIds]
  )

  const togglePick = (id: string) =>
    setPickedIds((current) => toggleOrderedSelection(current, id))

  const clearPicks = () => setPickedIds([])

  const queuePickedAssets = () => {
    const byId = new Map(assets.map((asset) => [asset.id, asset]))
    const picked = activePickedIds.flatMap((id) => {
      const asset = byId.get(id)
      return asset ? [asset] : []
    })
    if (queueLibraryAssetsInPickOrder(picked) > 0) clearPicks()
  }

  const selectedCollectionId = filter.startsWith("collection:")
    ? filter.slice("collection:".length)
    : null
  const selectedCollection = collections.find(
    (collection) => collection.id === selectedCollectionId,
  )

  const visibleAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return sortLibraryAssetsByImportOrder(
      assets.filter((asset) => {
        if (filter !== "all") {
          if (selectedCollectionId) {
            if (!asset.collectionIds.includes(selectedCollectionId)) return false
          } else if (asset.type !== filter) {
            return false
          }
        }
        if (!normalized) return true
        return (
          asset.name.toLowerCase().includes(normalized) ||
          asset.type.toLowerCase().includes(normalized)
        )
      })
    )
  }, [assets, filter, query, selectedCollectionId])

  const visibleQueueableAssets = useMemo(
    () => visibleAssets.filter(isPresentableLibraryAsset),
    [visibleAssets]
  )

  const addCollectionToPlan = () => {
    if (!selectedCollection) return
    for (const asset of collectionAssets(selectedCollection, assets)) {
      addItem(libraryAssetToServiceItem(asset))
    }
  }

  const queueVisibleAssets = () => {
    queueLibraryAssetsInImportOrder(visibleQueueableAssets)
  }

  return (
    <div className="glass-panel flex min-h-[calc(100vh-136px)] overflow-hidden" data-tour="library-workspace">
      <CollectionSidebar filter={filter} onFilterChange={setFilter} />

      <section className="flex min-w-0 flex-1 flex-col">
        <PanelHeader title="Library" icon={<LibraryIcon className="size-3" />}>
          {selectedCollection ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={addCollectionToPlan}
              disabled={selectedCollection.assetIds.length === 0}
            >
              <FolderInputIcon className="size-3" />
              Add collection to plan
            </Button>
          ) : null}
          {activePickedIds.length > 0 ? (
            <>
              <Button type="button" size="xs" onClick={queuePickedAssets}>
                <PlusIcon className="size-3" />
                Queue selected ({activePickedIds.length})
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={clearPicks}
              >
                Clear
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={queueVisibleAssets}
            disabled={visibleQueueableAssets.length === 0}
          >
            <PlusIcon className="size-3" />
            Queue visible
          </Button>
          <AddAssetMenu onCreateSong={() => setSongEditorOpen(true)} />
        </PanelHeader>

        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] p-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search library"
            className="max-w-sm"
          />
          <p className="text-xs text-muted-foreground">
            {visibleAssets.length} of {assets.length} assets
          </p>
        </div>

        {songEditorOpen ? (
          <SongEditor onClose={() => setSongEditorOpen(false)} />
        ) : (
          <div
            className="min-h-0 flex-1 overflow-y-auto p-3 outline-none"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Escape") clearPicks()
            }}
          >
            <AssetGrid
              assets={visibleAssets}
              pickedIds={activePickedIds}
              onSelectToggle={togglePick}
            />
          </div>
        )}
      </section>
    </div>
  )
}
