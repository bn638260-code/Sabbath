import { invokeTauri } from "@/lib/tauri-runtime"
import { useBibleStore } from "@/stores/bible-store"
import { getVerseFromItem, type Book, type QueueItem, type Verse } from "@/types"

export const BIBLE_CHAPTER_COUNTS = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150,
  31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28,
  16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5,
  1, 1, 1, 22,
]

export function chapterCountForBook(book: Book | null): number {
  if (!book) return 1
  return BIBLE_CHAPTER_COUNTS[book.book_number - 1] ?? 1
}

export function buildQueuedVerseKeys(queueItems: QueueItem[]): Set<string> {
  return new Set(
    queueItems
      .map((item) => {
        const verse = getVerseFromItem(item)
        if (!verse) return null
        return `${verse.book_number}:${verse.chapter}:${verse.verse}`
      })
      .filter((key): key is string => Boolean(key)),
  )
}

export function resolveEffectiveVerseId(
  selectedVerseId: number | null,
  currentChapter: Verse[],
  selectedVerse: Verse | null | undefined,
): number | null {
  if (!selectedVerseId || currentChapter.length === 0) return null
  if (currentChapter.some((v) => v.id === selectedVerseId)) return selectedVerseId
  if (!selectedVerse) return null
  return currentChapter.find((v) => v.verse === selectedVerse.verse)?.id ?? null
}

export async function changeActiveTranslation(translationId: number): Promise<void> {
  await invokeTauri("set_active_translation", { translationId })
  useBibleStore.getState().setActiveTranslation(translationId)
}

export function handleBookChapterKeyDown(
  e: React.KeyboardEvent,
  options: {
    currentChapter: Verse[]
    effectiveSelectedVerseId: number | null
    maxChapter: number
    setChapter: (updater: (chapter: number) => number) => void
    setSelectedVerseId: (id: number | null) => void
    onSelectVerse: (verse: Verse) => void
  },
): void {
  const {
    currentChapter,
    effectiveSelectedVerseId,
    maxChapter,
    setChapter,
    setSelectedVerseId,
    onSelectVerse,
  } = options

  if (e.key === "ArrowLeft") {
    e.preventDefault()
    setChapter((c) => (c > 1 ? c - 1 : c))
    setSelectedVerseId(null)
  } else if (e.key === "ArrowRight") {
    e.preventDefault()
    setChapter((c) => (c < maxChapter ? c + 1 : c))
    setSelectedVerseId(null)
  } else if (e.key === "ArrowDown") {
    e.preventDefault()
    if (currentChapter.length === 0) return
    const currentIdx = effectiveSelectedVerseId
      ? currentChapter.findIndex((v) => v.id === effectiveSelectedVerseId)
      : -1
    const nextIdx = Math.min(currentIdx + 1, currentChapter.length - 1)
    const next = currentChapter[nextIdx]
    if (next) {
      setSelectedVerseId(next.id)
      onSelectVerse(next)
      document
        .getElementById(`verse-${next.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault()
    if (currentChapter.length === 0) return
    const currentIdx = effectiveSelectedVerseId
      ? currentChapter.findIndex((v) => v.id === effectiveSelectedVerseId)
      : currentChapter.length
    const prevIdx = Math.max(currentIdx - 1, 0)
    const prev = currentChapter[prevIdx]
    if (prev) {
      setSelectedVerseId(prev.id)
      onSelectVerse(prev)
      document
        .getElementById(`verse-${prev.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }
}
