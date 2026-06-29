import { open } from "@tauri-apps/plugin-dialog"
import {
  FileImageIcon,
  FileUpIcon,
  LinkIcon,
  MusicIcon,
  PaletteIcon,
  PlusIcon,
  Rows3Icon,
  VideoIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { readImageThumbnail, saveLibraryImage } from "@/lib/library/library-image"
import {
  isProgressiveVideoUrl,
  parseYoutubeId,
  pickLibraryVideoPath,
  readVideoMetadata,
  validateLibraryVideoPath,
} from "@/lib/library/library-video"
import { deckToSongDoc } from "@/lib/library/song-doc"
import { downscaleImageToThumbnail } from "@/lib/library/thumbnail"
import { importPowerPointSlides, POWERPOINT_EXTENSIONS } from "@/lib/powerpoint-import"
import { convertTauriFileSrc } from "@/lib/tauri-runtime"
import {
  selectActiveTheme,
  useBroadcastThemeStore,
} from "@/stores/broadcast/theme-store"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useLibraryStore } from "@/stores/library-store"
import type { LibraryAsset } from "@/types/library"
import type { SlideDeckPresentationItemData } from "@/types"

const LIBRARY_PRESENTATION_IMAGE_MAX_SIZE = 1920

interface AddAssetMenuProps {
  onCreateSong: () => void
}

export function AddAssetMenu({ onCreateSong }: AddAssetMenuProps) {
  const addAsset = useLibraryStore((state) => state.addAsset)
  const activeTheme = useBroadcastThemeStore(selectActiveTheme)
  const hymnDeck = useHymnSlideStore((state) => state.deck)

  const importImage = async () => {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"],
        },
      ],
    })
    if (typeof selected !== "string") return

    const [saved, dataUrl] = await Promise.all([
      saveLibraryImage(selected),
      readImageThumbnail(selected),
    ])
    const thumbnail = await downscaleImageToThumbnail(
      dataUrl,
      LIBRARY_PRESENTATION_IMAGE_MAX_SIZE
    )
    addAsset({
      id: crypto.randomUUID(),
      name: saved.fileName.replace(/\.[^.]+$/, ""),
      type: "image",
      collectionIds: [],
      fileName: saved.fileName,
      width: saved.width,
      height: saved.height,
      mimeType: saved.mimeType,
      thumbnail,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  const saveTheme = () => {
    if (!activeTheme) return
    addAsset({
      id: crypto.randomUUID(),
      name: activeTheme.name,
      type: "theme",
      collectionIds: [],
      theme: { ...activeTheme, builtin: false },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  const saveCurrentDeck = () => {
    if (hymnDeck.length === 0) return
    addAsset({
      id: crypto.randomUUID(),
      name: hymnDeck[0]?.hymnTitle ?? "Song Deck",
      type: "song",
      collectionIds: [],
      song: deckToSongDoc(hymnDeck[0]?.hymnTitle ?? "Song Deck", hymnDeck),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  const importPowerPoint = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "PowerPoint", extensions: POWERPOINT_EXTENSIONS }],
    })
    if (typeof selected !== "string") return
    const slides = await importPowerPointSlides(selected)
    addAsset(createSlideTemplateAsset(slides))
  }

  const importVideo = async () => {
    const selected = await pickLibraryVideoPath()
    if (!selected) return
    const validated = await validateLibraryVideoPath(selected)
    const metadata = await readVideoMetadata(convertTauriFileSrc(selected))
    addAsset({
      id: crypto.randomUUID(),
      name: validated.label.replace(/\.[^.]+$/, ""),
      type: "video",
      source: "local",
      collectionIds: [],
      filePath: selected,
      mimeType: validated.mimeType,
      durationMs: metadata.durationMs,
      width: metadata.width,
      height: metadata.height,
      thumbnail: metadata.thumbnail,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  const addVideoUrl = async () => {
    const url = window.prompt("Paste a direct HTTPS .mp4 or .webm URL")
    if (!url || !isProgressiveVideoUrl(url)) return
    const metadata = await readVideoMetadata(url)
    addAsset({
      id: crypto.randomUUID(),
      name: url.split("/").pop()?.replace(/\.[^.]+$/, "") || "Video URL",
      type: "video",
      source: "url",
      collectionIds: [],
      url,
      mimeType: url.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4",
      durationMs: metadata.durationMs,
      width: metadata.width,
      height: metadata.height,
      thumbnail: metadata.thumbnail,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  const addYoutubeLink = () => {
    const input = window.prompt("Paste a YouTube URL or video ID")
    if (!input) return
    const youtubeId = parseYoutubeId(input)
    if (!youtubeId) return
    addAsset({
      id: crypto.randomUUID(),
      name: `YouTube ${youtubeId}`,
      type: "video",
      source: "youtube",
      collectionIds: [],
      youtubeId,
      thumbnail: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm">
          <PlusIcon className="size-3.5" />
          Add Asset
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => void importImage()}>
          <FileImageIcon className="size-4" />
          Import image
        </DropdownMenuItem>
        <DropdownMenuItem onClick={saveTheme} disabled={!activeTheme}>
          <PaletteIcon className="size-4" />
          Save current theme
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCreateSong}>
          <MusicIcon className="size-4" />
          New song
        </DropdownMenuItem>
        <DropdownMenuItem onClick={saveCurrentDeck} disabled={hymnDeck.length === 0}>
          <Rows3Icon className="size-4" />
          Save current deck
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void importPowerPoint()}>
          <FileUpIcon className="size-4" />
          Import PowerPoint
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void importVideo()}>
          <VideoIcon className="size-4" />
          Import video
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void addVideoUrl()}>
          <LinkIcon className="size-4" />
          Add video URL
        </DropdownMenuItem>
        <DropdownMenuItem onClick={addYoutubeLink}>
          <VideoIcon className="size-4" />
          Add YouTube link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function createSlideTemplateAsset(
  slides: Array<{ index: number; dataUrl: string; label: string; textLines: string[] }>
): LibraryAsset {
  const id = crypto.randomUUID()
  const deck: SlideDeckPresentationItemData[] = slides.map((slide) => ({
    kind: "slideDeck",
    deckId: id,
    deckTitle: "Imported PowerPoint",
    slideId: `${id}-${slide.index}`,
    slideIndex: slide.index,
    slideCount: slides.length,
    slidePath: slide.dataUrl,
    reference: slide.label,
    segments: [{ text: slide.label }],
    extractedTextLines: slide.textLines,
  }))
  return {
    id,
    name: "Imported PowerPoint",
    type: "slide-template",
    collectionIds: [],
    thumbnail: slides[0]?.dataUrl,
    deck,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}
