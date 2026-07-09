import type { BroadcastTheme, HymnPresentationItemData, SlideDeckPresentationItemData } from "@/types"
import type { VideoSourceKind } from "./presentation"

export type LibraryAssetType = "theme" | "image" | "song" | "slide-template" | "video"

export type SongSectionKind = "verse" | "chorus" | "bridge"

export interface SongDoc {
  title: string
  sections: Array<{
    kind: SongSectionKind
    index?: number
    lines: string[]
  }>
}

export interface LibraryCollection {
  id: string
  name: string
  assetIds: string[]
  coverAssetId?: string
  createdAt: number
  updatedAt: number
}

interface LibraryAssetBase {
  id: string
  name: string
  type: LibraryAssetType
  collectionIds: string[]
  tags?: string[]
  thumbnail?: string
  /** Stable number assigned when the asset enters the library. */
  importOrder?: number
  createdAt: number
  updatedAt: number
}

export interface LibraryThemeAsset extends LibraryAssetBase {
  type: "theme"
  theme: BroadcastTheme
}

export interface LibraryImageAsset extends LibraryAssetBase {
  type: "image"
  fileName: string
  width: number
  height: number
  mimeType: string
}

export interface LibrarySongAsset extends LibraryAssetBase {
  type: "song"
  song: SongDoc
}

export interface LibrarySlideTemplateAsset extends LibraryAssetBase {
  type: "slide-template"
  deck: SlideDeckPresentationItemData[]
  /** Render this imported deck inside the active theme instead of full-bleed on black. */
  applyTheme?: boolean
}

export interface LibraryVideoAsset extends LibraryAssetBase {
  type: "video"
  source: VideoSourceKind
  filePath?: string
  url?: string
  youtubeId?: string
  durationMs?: number
  width?: number
  height?: number
  mimeType?: string
}

export type LibraryAsset =
  | LibraryThemeAsset
  | LibraryImageAsset
  | LibrarySongAsset
  | LibrarySlideTemplateAsset
  | LibraryVideoAsset

export type LibraryPreviewAsset =
  | LibraryImageAsset
  | LibrarySongAsset
  | LibrarySlideTemplateAsset
  | LibraryThemeAsset
  | LibraryVideoAsset

export type SongDeck = HymnPresentationItemData[]
