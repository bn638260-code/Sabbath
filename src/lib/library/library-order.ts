import type { LibraryAsset } from "@/types/library"

function hasImportOrder(
  asset: LibraryAsset
): asset is LibraryAsset & { importOrder: number } {
  const importOrder = asset.importOrder
  return (
    typeof importOrder === "number" &&
    Number.isFinite(importOrder) &&
    importOrder > 0
  )
}

export function compareLibraryAssetsByImportOrder(
  a: LibraryAsset,
  b: LibraryAsset
): number {
  const orderA = hasImportOrder(a) ? a.importOrder : Number.MAX_SAFE_INTEGER
  const orderB = hasImportOrder(b) ? b.importOrder : Number.MAX_SAFE_INTEGER
  if (orderA !== orderB) return orderA - orderB
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
}

export function sortLibraryAssetsByImportOrder(
  assets: LibraryAsset[]
): LibraryAsset[] {
  return [...assets].sort(compareLibraryAssetsByImportOrder)
}

export function normalizeLibraryImportOrder(
  assets: LibraryAsset[]
): LibraryAsset[] {
  const used = new Set(
    assets.filter(hasImportOrder).map((asset) => asset.importOrder)
  )
  let next = 1
  const nextAvailableOrder = () => {
    while (used.has(next)) next += 1
    used.add(next)
    return next
  }

  return sortLibraryAssetsByImportOrder(assets).map((asset) =>
    hasImportOrder(asset)
      ? asset
      : { ...asset, importOrder: nextAvailableOrder() }
  )
}

export function assignLibraryImportOrder(
  asset: LibraryAsset,
  assets: LibraryAsset[],
  existing?: LibraryAsset
): LibraryAsset {
  if (hasImportOrder(asset)) return asset
  if (existing && hasImportOrder(existing)) {
    return { ...asset, importOrder: existing.importOrder }
  }
  const maxImportOrder = assets.reduce(
    (max, entry) =>
      hasImportOrder(entry) ? Math.max(max, entry.importOrder) : max,
    0
  )
  return { ...asset, importOrder: maxImportOrder + 1 }
}
