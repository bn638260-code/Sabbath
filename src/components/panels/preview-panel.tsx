import { useEffect, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CanvasVerse } from "@/components/ui/canvas-verse"
import { PanelHeader } from "@/components/ui/panel-header"
import { bibleActions } from "@/hooks/use-bible"
import { toVerseRenderData } from "@/hooks/use-broadcast"
import { commitPreviewToLive } from "@/lib/presentation-workflow"
import { useBibleStore } from "@/stores/bible-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { MonitorIcon, SendIcon, XIcon } from "lucide-react"

export function PreviewPanel() {
  const selectedVerse = useBibleStore((s) => s.selectedVerse)
  const translations = useBibleStore((s) => s.translations)
  const activeTranslationId = useBibleStore((s) => s.activeTranslationId)
  const themes = useBroadcastStore((s) => s.themes)
  const activeThemeId = useBroadcastStore((s) => s.activeThemeId)
  const isLive = useBroadcastStore((s) => s.isLive)
  const readingModeAutoLive = useBroadcastStore((s) => s.readingModeAutoLive)

  useEffect(() => {
    const verse = useBibleStore.getState().selectedVerse
    if (verse && verse.book_number > 0 && verse.chapter > 0 && verse.verse > 0) {
      bibleActions
        .fetchVerse(verse.book_number, verse.chapter, verse.verse)
        .then((v) => {
          if (v) bibleActions.selectVerse(v)
        })
        .catch(() => {})
    }
  }, [activeTranslationId])

  const activeTheme = useMemo(
    () => themes.find((t) => t.id === activeThemeId) ?? themes[0],
    [themes, activeThemeId],
  )

  const translation = useMemo(
    () => translations.find((t) => t.id === activeTranslationId)?.abbreviation ?? "KJV",
    [translations, activeTranslationId],
  )

  const verseData = useMemo(
    () => (selectedVerse ? toVerseRenderData(selectedVerse, translation) : null),
    [selectedVerse, translation],
  )
  const clearPreviewBlocked = isLive && readingModeAutoLive

  const clearPreview = () => {
    if (clearPreviewBlocked) return
    useBibleStore.getState().selectVerse(null)
  }

  return (
    <div
      data-slot="preview-panel"
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      <PanelHeader title="Program preview" icon={<MonitorIcon className="size-3" />}>
        <Badge variant="outline" className="h-5 text-[0.5625rem] uppercase">
          Staged
        </Badge>
      </PanelHeader>

      <div className="flex min-h-10 items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {verseData?.reference ?? "No verse selected"}
          </p>
          <p className="text-xs text-muted-foreground">
            Preview only. Audience output changes when sent live.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!verseData || clearPreviewBlocked}
            className="gap-1.5"
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
            disabled={!verseData}
            className="gap-1.5"
            onClick={() => commitPreviewToLive()}
          >
            <SendIcon className="size-3.5" />
            Send Live
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        <CanvasVerse theme={activeTheme} verse={verseData} />
      </div>
    </div>
  )
}
