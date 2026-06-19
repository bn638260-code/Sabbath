import {
  previewVerseAndMaybeAutoLive,
  selectPreviewVerse,
  createScriptureQueueItem,
  previewEgwParagraph,
  presentEgwParagraph,
  createEgwQueueItem,
} from "@/lib/presentation-workflow"
import { bibleActions } from "@/hooks/use-bible"
import { useBibleStore } from "@/stores/bible-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useDetectionStore } from "@/stores/detection-store"
import { useQueueStore } from "@/stores/queue-store"
import type {
  DetectionResult,
  EgwParagraph,
  ReadingAdvance,
  Verse,
} from "@/types"

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

function findCurrentChapterVerse(detection: DetectionResult): Verse | null {
  const { activeTranslationId, currentChapter } = useBibleStore.getState()
  return (
    currentChapter.find(
      (verse) =>
        verse.translation_id === activeTranslationId &&
        verse.book_number === detection.book_number &&
        verse.chapter === detection.chapter &&
        verse.verse === detection.verse
    ) ?? null
  )
}

function isEgwDetection(
  detection: DetectionResult
): detection is DetectionResult & { egw_paragraph: EgwParagraph } {
  return detection.content_type === "egw" && Boolean(detection.egw_paragraph)
}

interface ResolvedDetectionVerse {
  verse: Verse
  usedFallback: boolean
  fallbackReason?: string
}

async function resolveDetectionVerse(
  detection: DetectionResult
): Promise<ResolvedDetectionVerse> {
  if (
    detection.book_number > 0 &&
    detection.chapter > 0 &&
    detection.verse > 0
  ) {
    try {
      const verse = await bibleActions.fetchVerse(
        detection.book_number,
        detection.chapter,
        detection.verse
      )
      if (verse) {
        return { verse, usedFallback: false }
      }
    } catch (error) {
      const currentVerse = findCurrentChapterVerse(detection)
      if (currentVerse) {
        useBroadcastStore.getState().reportOutputIssue({
          outputId: "global",
          kind: "verse-lookup",
          title: "Verse lookup failed",
          description: `Used loaded chapter text for ${detection.verse_ref}: ${String(error)}`,
        })
        return {
          verse: currentVerse,
          usedFallback: true,
          fallbackReason: "chapter-cache",
        }
      }

      useBroadcastStore.getState().reportOutputIssue({
        outputId: "global",
        kind: "verse-lookup",
        title: "Verse lookup failed",
        description: `Used detection text for ${detection.verse_ref}: ${String(error)}`,
      })
      return {
        verse: detectionLikeToVerse(detection),
        usedFallback: true,
        fallbackReason: "detection-text",
      }
    }

    const currentVerse = findCurrentChapterVerse(detection)
    if (currentVerse) {
      return { verse: currentVerse, usedFallback: false }
    }
  }
  return {
    verse: detectionLikeToVerse(detection),
    usedFallback: true,
    fallbackReason: "unresolved-detection",
  }
}

function selectPreviewDirectHit(
  detections: DetectionResult[]
): DetectionResult | null {
  const directHits = detections.filter(
    (d) =>
      d.source === "direct" &&
      !d.is_chapter_only &&
      (isEgwDetection(d) || d.book_number > 0)
  )
  if (directHits.length === 0) return null

  let best = directHits[0]
  for (let i = 1; i < directHits.length; i += 1) {
    const candidate = directHits[i]
    if (candidate.confidence > best.confidence) {
      best = candidate
    }
  }
  return best
}

async function queueDetectedVerse(
  detection: DetectionResult,
  resolvedDetection?: ResolvedDetectionVerse
): Promise<void> {
  if (isEgwDetection(detection)) {
    if (!detection.auto_queued) return

    useQueueStore.getState().addOrFlashItem(
      createEgwQueueItem(detection.egw_paragraph, {
        confidence: detection.confidence,
        source: "ai-direct",
      })
    )
    return
  }

  const { verse } = resolvedDetection ?? (await resolveDetectionVerse(detection))
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
        verse.text
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
    })
  )
}

let detectionHandlingChain: Promise<void> = Promise.resolve()

function reportDetectionBatchError(error: unknown): void {
  useBroadcastStore.getState().reportOutputIssue({
    outputId: "global",
    kind: "auto-detection",
    title: "Detection batch failed",
    description: `An unexpected detection batch error occurred: ${String(error)}`,
  })
}

async function handleVerseDetectionsInternal(detections: DetectionResult[]) {
  useDetectionStore.getState().addDetections(detections)

  const directHit = selectPreviewDirectHit(detections)
  const resolvedDetections = new WeakMap<DetectionResult, ResolvedDetectionVerse>()
  if (directHit) {
    if (isEgwDetection(directHit)) {
      if (directHit.auto_queued) {
        presentEgwParagraph(directHit.egw_paragraph)
      } else {
        previewEgwParagraph(directHit.egw_paragraph)
      }
    } else {
      const resolved = await resolveDetectionVerse(directHit)
      resolvedDetections.set(directHit, resolved)
      selectPreviewVerse(resolved.verse)
    }
  }

  for (const detection of detections) {
    await queueDetectedVerse(detection, resolvedDetections.get(detection))
  }
}

export async function handleVerseDetections(detections: DetectionResult[]) {
  detectionHandlingChain = detectionHandlingChain
    .catch((error) => {
      reportDetectionBatchError(error)
    })
    .then(() => handleVerseDetectionsInternal(detections))
    .catch((error) => {
      reportDetectionBatchError(error)
    })
  return detectionHandlingChain
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
}
