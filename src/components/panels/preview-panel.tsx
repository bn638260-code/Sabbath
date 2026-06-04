import { useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CanvasPresentation } from "@/components/ui/canvas-verse"
import { PanelHeader } from "@/components/ui/panel-header"
import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { bibleActions } from "@/hooks/use-bible"
import {
  commitPreviewToLive,
  selectPreviewItem,
  selectPreviewVerse,
} from "@/lib/presentation-workflow"
import { useBibleStore } from "@/stores/bible-store"
import { selectActiveTheme, useBroadcastStore } from "@/stores/broadcast-store"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import { PresentationDeckControls } from "@/components/panels/presentation-deck-controls"
import { presentationDeckKind } from "@/lib/presentation-deck-navigation"
import { MonitorIcon, SendIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function PreviewPanel({ className }: { className?: string }) {
  const activeTranslationId = useBibleStore((s) => s.activeTranslationId)
  const previewItem = useBroadcastStore((s) => s.previewItem)
  const activeTheme = useBroadcastStore(selectActiveTheme)
  const isLive = useBroadcastStore((s) => s.isLive)
  const readingModeAutoLive = useBroadcastStore((s) => s.readingModeAutoLive)

  useEffect(() => {
    if (useBroadcastStore.getState().previewItem?.kind !== "scripture") return
    const verse = useBibleStore.getState().selectedVerse
    if (verse && verse.book_number > 0 && verse.chapter > 0 && verse.verse > 0) {
      bibleActions
        .fetchVerse(verse.book_number, verse.chapter, verse.verse)
        .then((v) => {
          if (v) selectPreviewVerse(v)
        })
        .catch((e) => console.error("[preview] verse refetch on translation change failed", e))
    }
  }, [activeTranslationId])

  const clearPreviewBlocked = isLive && readingModeAutoLive

  const clearPreview = () => {
    if (clearPreviewBlocked) return
    useBroadcastStore.getState().setPreviewItem(null)
    useBibleStore.getState().selectVerse(null)
  }

  const navigatePreviewDeck = (kind: "hymn" | "slideDeck", index: number) => {
    if (kind === "hymn") {
      const hymnSlides = useHymnSlideStore.getState()
      const next = hymnSlides.deck[index]
      if (!next) return
      hymnSlides.setDeck(hymnSlides.deck, index)
      selectPreviewItem(next)
      return
    }
    const sermonSlides = useSermonSlideStore.getState()
    const next = sermonSlides.deck[index]
    if (!next) return
    sermonSlides.setDeck(sermonSlides.deck, index, sermonSlides.activeItemId)
    selectPreviewItem(next)
  }

  return (
    <div
      data-slot="preview-panel"
      className={cn(
        "glass-panel relative flex min-h-0 flex-col overflow-hidden",
        className,
      )}
    >
      <PanelHeader title="Program preview" icon={<MonitorIcon className="size-3" />} step={2}>
        <Badge variant="outline" className="h-5 text-[0.5625rem] uppercase">
          Staged
        </Badge>
      </PanelHeader>

      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {previewItem?.reference ?? "No item selected"}
          </p>
          <p className="text-xs text-muted-foreground">
            Preview only. Verses, hymns, and songs change audience output when sent live.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {presentationDeckKind(previewItem) ? (
            <PresentationDeckControls
              item={previewItem}
              onNavigate={navigatePreviewDeck}
            />
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled={!previewItem || clearPreviewBlocked}
            className="gap-2"
            onClick={clearPreview}
            title={
              clearPreviewBlocked
                ? "Turn off Auto-live reading mode or hide Live Output before clearing preview"
                : "Clear preview"
            }
          >
            <XIcon className="size-3.5" />
            Clear
          </Button>
          <Button
            size="sm"
            disabled={!previewItem}
            className="gap-2"
            onClick={() => commitPreviewToLive()}
          >
            <SendIcon className="size-3.5" />
            Send Live
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        {previewItem && activeTheme ? (
          <CanvasPresentation theme={activeTheme} item={previewItem} />
        ) : (
          <PanelEmptyState
            icon={<MonitorIcon className="size-8" />}
            title="No item selected"
            description="Detected verses, searched passages, hymns, and song slides appear here before going live."
          />
        )}
      </div>
    </div>
  )
}
