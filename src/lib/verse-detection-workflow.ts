import {
  previewVerseAndMaybeAutoLive,
  selectPreviewVerse,
  createScriptureQueueItem,
} from "@/lib/presentation-workflow"
import { bibleActions } from "@/hooks/use-bible"
import { useBibleStore } from "@/stores/bible-store"
import { useDetectionStore } from "@/stores/detection-store"
import { useQueueStore } from "@/stores/queue-store"
import type { DetectionResult, ReadingAdvance, Verse } from "@/types"

function detectionLikeToVerse({
  book_number,
  book_name,
  chapter,
  verse,
  verse_text,
}: {
  book_number: number
  book_name: string
  chapter: number
  verse: number
  verse_text: string
}): Verse {
  return {
    id: 0,
    translation_id: useBibleStore.getState().activeTranslationId,
    book_number,
    book_name,
    book_abbreviation: "",
    chapter,
    verse,
    text: verse_text,
  }
}

function selectDetectedVerse(args: {
  book_number: number
  book_name: string
  chapter: number
  verse: number
  verse_text: string
}) {
  const verse = detectionLikeToVerse(args)
  selectPreviewVerse(verse)
  useBibleStore.getState().setPendingNavigation({
    bookNumber: args.book_number,
    chapter: args.chapter,
    verse: args.verse,
  })
}

function findCurrentChapterVerse(detection: DetectionResult): Verse | null {
  const { activeTranslationId, currentChapter } = useBibleStore.getState()
  return (
    currentChapter.find(
      (verse) =>
        verse.translation_id === activeTranslationId &&
        verse.book_number === detection.book_number &&
        verse.chapter === detection.chapter &&
        verse.verse === detection.verse,
    ) ?? null
  )
}

async function resolveDetectionVerse(detection: DetectionResult): Promise<Verse> {
  if (detection.book_number > 0 && detection.chapter > 0 && detection.verse > 0) {
    try {
      const verse = await bibleActions.fetchVerse(
        detection.book_number,
        detection.chapter,
        detection.verse,
      )
      if (verse) return verse
    } catch {
      // Queueing should still work when a translation lookup is unavailable.
    }

    const currentVerse = findCurrentChapterVerse(detection)
    if (currentVerse) return currentVerse
  }
  return detectionLikeToVerse(detection)
}

async function queueDetectedVerse(detection: DetectionResult): Promise<void> {
  const verse = await resolveDetectionVerse(detection)
  if (
    !detection.is_chapter_only &&
    detection.source === "direct" &&
    useQueueStore
      .getState()
      .updateEarlyRef(
        verse.book_number,
        verse.chapter,
        verse.verse,
        detection.verse_ref,
        verse.text,
      )
  ) {
    return
  }

  if (!detection.auto_queued) return

  useQueueStore.getState().addOrFlashDetectionItem(
    createScriptureQueueItem(verse, {
      reference: detection.verse_ref,
      confidence: detection.confidence,
      source: detection.source === "direct" ? "ai-direct" : "ai-semantic",
      is_chapter_only: detection.is_chapter_only,
    }),
  )
}

export async function handleVerseDetections(detections: DetectionResult[]) {
  useDetectionStore.getState().addDetections(detections)

  // Preview from the incoming event's newest direct non-chapter-only detection
  // (not from the full persisted detection store)
  const directHits = detections.filter(
    (d) => d.source === "direct" && !d.is_chapter_only
  )
  // Use the first direct hit (newest in the incoming batch)
  if (directHits.length > 0) {
    const directHit = directHits[0]
    if (directHit.book_number > 0) {
      selectDetectedVerse(directHit)
    }
  }

  await Promise.all(detections.map(queueDetectedVerse))
}

export function handleReadingAdvance(advance: ReadingAdvance) {
  if (advance.book_number <= 0) return

  const verse = detectionLikeToVerse({
    book_number: advance.book_number,
    book_name: advance.book_name,
    chapter: advance.chapter,
    verse: advance.verse,
    verse_text: advance.verse_text,
  })

  previewVerseAndMaybeAutoLive(verse, {
    autoLiveWhenAlreadyOn: true,
  })

  useBibleStore.getState().setPendingNavigation({
    bookNumber: advance.book_number,
    chapter: advance.chapter,
    verse: advance.verse,
  })
}
