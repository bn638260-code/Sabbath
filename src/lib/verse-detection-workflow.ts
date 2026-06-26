import {
  previewVerseAndMaybeAutoLive,
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
import { useSettingsStore } from "@/stores/settings-store"
import {
  recordWorkflowTrace,
  traceDetectionBatchDetails,
  traceDetectionDetails,
  traceReadingAdvanceDetails,
  traceVerseDetails,
} from "@/lib/workflow-trace"
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

function readingAdvanceToDetection(advance: ReadingAdvance): DetectionResult {
  return {
    content_type: "bible",
    verse_ref: advance.reference,
    verse_text: advance.verse_text,
    book_name: advance.book_name,
    book_number: advance.book_number,
    chapter: advance.chapter,
    verse: advance.verse,
    confidence: advance.confidence,
    source: "direct",
    auto_queued: false,
    transcript_snippet: "",
    is_chapter_only: false,
    egw_paragraph: null,
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

function bestDetection(detections: DetectionResult[]): DetectionResult | null {
  if (detections.length === 0) return null

  let best = detections[0]
  for (let i = 1; i < detections.length; i += 1) {
    const candidate = detections[i]
    if (candidate.confidence > best.confidence) {
      best = candidate
    }
  }
  return best
}

function selectPreviewHit(
  detections: DetectionResult[],
  minConfidence: number,
  semanticMinConfidence: number
): DetectionResult | null {
  const directHits = detections.filter(
    (d) =>
      d.source === "direct" &&
      d.confidence >= minConfidence &&
      !d.is_chapter_only &&
      (isEgwDetection(d) || d.book_number > 0)
  )
  const directHit = bestDetection(directHits)
  if (directHit) return directHit

  const semanticAutoLiveThreshold = Math.max(
    minConfidence,
    semanticMinConfidence
  )
  return bestDetection(
    detections.filter(
      (d) =>
        d.source === "semantic" &&
        d.confidence >= semanticAutoLiveThreshold &&
        !d.is_chapter_only &&
        d.book_number > 0
    )
  )
}

async function queueDetectedVerse(
  detection: DetectionResult,
  resolvedDetection?: ResolvedDetectionVerse
): Promise<void> {
  if (isEgwDetection(detection)) {
    if (!detection.auto_queued) {
      recordWorkflowTrace(
        "detection.queue.skipped",
        "EGW detection not queued",
        {
          reason: "auto_queued_false",
          detection: traceDetectionDetails(detection),
        }
      )
      return
    }

    useQueueStore.getState().addOrFlashItem(
      createEgwQueueItem(detection.egw_paragraph, {
        confidence: detection.confidence,
        source: "ai-direct",
      })
    )
    recordWorkflowTrace("detection.queue.added", "EGW detection queued", {
      detection: traceDetectionDetails(detection),
    })
    return
  }

  const { verse } =
    resolvedDetection ?? (await resolveDetectionVerse(detection))
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
    recordWorkflowTrace(
      "detection.queue.added",
      "Existing early reference updated",
      {
        action: "update_existing_early_ref",
        detection: traceDetectionDetails(detection),
        verse: traceVerseDetails(verse),
      }
    )
    return
  }

  if (!detection.auto_queued) {
    recordWorkflowTrace("detection.queue.skipped", "Detection not queued", {
      reason: "auto_queued_false",
      detection: traceDetectionDetails(detection),
      verse: traceVerseDetails(verse),
    })
    return
  }

  useQueueStore.getState().addOrFlashDetectionItem(
    createScriptureQueueItem(verse, {
      reference: detection.verse_ref,
      confidence: detection.confidence,
      source: detection.source === "direct" ? "ai-direct" : "ai-semantic",
      is_chapter_only: detection.is_chapter_only,
    })
  )
  recordWorkflowTrace("detection.queue.added", "Detection queued", {
    detection: traceDetectionDetails(detection),
    verse: traceVerseDetails(verse),
  })
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

  const settings = useSettingsStore.getState()
  const autoPreview = settings.autoMode
  recordWorkflowTrace("detection.batch", "Detection batch entered workflow", {
    ...traceDetectionBatchDetails(detections),
    autoMode: settings.autoMode,
    confidenceThreshold: settings.confidenceThreshold,
    semanticConfidenceThreshold: settings.semanticConfidenceThreshold,
  })
  const previewHit = autoPreview
    ? selectPreviewHit(
        detections,
        settings.confidenceThreshold,
        settings.semanticConfidenceThreshold
      )
    : null
  const resolvedDetections = new WeakMap<
    DetectionResult,
    ResolvedDetectionVerse
  >()
  if (previewHit) {
    if (isEgwDetection(previewHit)) {
      recordWorkflowTrace(
        "detection.preview.selected",
        "EGW direct hit selected",
        {
          detection: traceDetectionDetails(previewHit),
          autoQueued: previewHit.auto_queued,
        }
      )
      if (previewHit.auto_queued) {
        presentEgwParagraph(previewHit.egw_paragraph)
      } else {
        previewEgwParagraph(previewHit.egw_paragraph)
      }
    } else {
      const resolved = await resolveDetectionVerse(previewHit)
      resolvedDetections.set(previewHit, resolved)
      recordWorkflowTrace(
        "detection.preview.selected",
        "Detection selected for preview",
        {
          detection: traceDetectionDetails(previewHit),
          verse: traceVerseDetails(resolved.verse),
          usedFallback: resolved.usedFallback,
          fallbackReason: resolved.fallbackReason,
        }
      )
      previewVerseAndMaybeAutoLive(resolved.verse, { autoLive: true })
    }
  } else if (autoPreview) {
    recordWorkflowTrace(
      "detection.preview.skipped",
      "No trusted hit met preview criteria",
      {
        count: detections.length,
        confidenceThreshold: settings.confidenceThreshold,
        semanticConfidenceThreshold: settings.semanticConfidenceThreshold,
      }
    )
  }

  // In Auto mode, detections only stage to preview; the queue stays
  // operator-driven.
  if (autoPreview) {
    recordWorkflowTrace(
      "detection.queue.skipped",
      "Auto mode keeps detection queue operator-driven",
      {
        reason: "auto_mode_preview_only",
        count: detections.length,
      }
    )
    return
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
  if (advance.book_number <= 0) {
    recordWorkflowTrace("reading.ignored", "Reading advance ignored", {
      reason: "invalid_book",
      ...traceReadingAdvanceDetails(advance),
    })
    return
  }

  // Reading mode streams high-confidence advances while a passage is read.
  // Only auto-stage them in Auto broadcast mode; in Manual mode the operator
  // drives preview/live manually.
  const settings = useSettingsStore.getState()
  if (!settings.autoMode) {
    recordWorkflowTrace("reading.ignored", "Reading advance ignored", {
      reason: "manual_mode",
      ...traceReadingAdvanceDetails(advance),
    })
    return
  }

  const verse = detectionLikeToVerse({
    book_number: advance.book_number,
    book_name: advance.book_name,
    chapter: advance.chapter,
    verse: advance.verse,
    verse_text: advance.verse_text,
  })

  const broadcast = useBroadcastStore.getState()
  recordWorkflowTrace("reading.accepted", "Reading advance accepted", {
    ...traceReadingAdvanceDetails(advance),
    liveWasOn: broadcast.isLive,
    readingModeAutoLive: broadcast.readingModeAutoLive,
    verse: traceVerseDetails(verse),
  })

  // Surface the advancing verse in the detections panel — reading mode otherwise
  // stages straight to preview, leaving the operator with no detection card for
  // the verse currently being read.
  useDetectionStore.getState().addDetection(readingAdvanceToDetection(advance))

  previewVerseAndMaybeAutoLive(verse, {
    autoLive: true,
  })
}
