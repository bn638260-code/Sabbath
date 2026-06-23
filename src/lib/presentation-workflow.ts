import { bibleActions } from "@/hooks/use-bible"
import { toVerseRenderData } from "@/hooks/use-broadcast"
import { useBibleStore } from "@/stores/bible-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import type {
  DetectionResult,
  Verse,
  QueueItem,
  PresentationItem,
  PresentationRenderData,
  ScripturePresentationItemData,
  EgwParagraph,
  EgwPresentationItemData,
} from "@/types"
import { getPresentationRenderData, getScriptureVerse } from "@/types"
import { splitTextForReadableSlides } from "@/lib/text-slide-chunking"
import { useEgwSlideStore } from "@/stores/egw-slide-store"
import {
  recordWorkflowTrace,
  tracePresentationDetails,
  traceVerseDetails,
} from "@/lib/workflow-trace"

function activeTranslationLabel(): string {
  const bible = useBibleStore.getState()
  return (
    bible.translations.find((t) => t.id === bible.activeTranslationId)
      ?.abbreviation ?? "KJV"
  )
}

export function detectionToVerse(detection: DetectionResult): Verse {
  return {
    id: 0,
    translation_id: useBibleStore.getState().activeTranslationId,
    book_number: detection.book_number,
    book_name: detection.book_name,
    book_abbreviation: "",
    chapter: detection.chapter,
    verse: detection.verse,
    text: detection.verse_text,
  }
}

export function createPresentationItem(
  verse: Verse,
  reference?: string
): ScripturePresentationItemData {
  return {
    kind: "scripture",
    verse,
    reference:
      reference ?? `${verse.book_name} ${verse.chapter}:${verse.verse}`,
  }
}

export function createScriptureQueueItem(
  verse: Verse,
  options?: {
    reference?: string
    confidence?: number
    source?: QueueItem["source"]
    is_chapter_only?: boolean
  }
): QueueItem {
  return {
    id: crypto.randomUUID(),
    presentation: createPresentationItem(verse, options?.reference),
    confidence: options?.confidence ?? 1,
    source: options?.source ?? "manual",
    added_at: Date.now(),
    is_chapter_only: options?.is_chapter_only,
  }
}

export function selectPreviewVerse(
  verse: Verse,
  options?: { navigate?: boolean }
) {
  const item = createPresentationItem(verse)
  const renderData = toScriptureRenderData(item)
  useBroadcastStore.getState().setPreviewItem(renderData)
  bibleActions.selectVerse(verse)
  recordWorkflowTrace("preview.selected", "Verse selected for preview", {
    navigate: Boolean(options?.navigate),
    verse: traceVerseDetails(verse),
    preview: tracePresentationDetails(renderData),
  })

  if (options?.navigate && verse.book_number > 0) {
    bibleActions.navigateToVerse(verse.book_number, verse.chapter, verse.verse)
  }
}

export function selectPreviewItem(
  item: PresentationItem,
  options?: { navigate?: boolean }
) {
  const verse = getScriptureVerse(item)
  const renderData = toPresentationRenderData(item)
  useBroadcastStore.getState().setPreviewItem(renderData)
  recordWorkflowTrace("preview.selected", "Item selected for preview", {
    navigate: Boolean(options?.navigate),
    preview: tracePresentationDetails(renderData),
  })

  if (verse) {
    bibleActions.selectVerse(verse)
    if (options?.navigate && verse.book_number > 0) {
      bibleActions.navigateToVerse(
        verse.book_number,
        verse.chapter,
        verse.verse
      )
    }
  }
}

function toScriptureRenderData(
  item: ScripturePresentationItemData
): PresentationRenderData {
  return toVerseRenderData(item.verse, activeTranslationLabel())
}

function toPresentationRenderData(
  item: PresentationItem
): PresentationRenderData {
  if (item.kind === "scripture") return toScriptureRenderData(item)
  return getPresentationRenderData(item)
}

function commitRenderDataToLive(
  renderData: PresentationRenderData,
  options?: { makeLive?: boolean }
) {
  const broadcast = useBroadcastStore.getState()
  recordWorkflowTrace("live.commit", "Presentation committed to live", {
    makeLive: options?.makeLive ?? true,
    liveWasOn: broadcast.isLive,
    live: tracePresentationDetails(renderData),
  })
  useBroadcastStore.getState().commitLiveItem(renderData, options)
}

export function commitVerseToLive(
  verse: Verse,
  options?: { makeLive?: boolean }
) {
  const renderData = toPresentationRenderData(createPresentationItem(verse))
  commitRenderDataToLive(renderData, options)
}

export function commitPreviewToLive(): boolean {
  const previewItem =
    useBroadcastStore.getState().previewItem ??
    (() => {
      const verse = useBibleStore.getState().selectedVerse
      return verse
        ? toPresentationRenderData(createPresentationItem(verse))
        : null
    })()
  if (!previewItem) return false

  commitRenderDataToLive(previewItem)
  return true
}

export function presentItem(
  item: PresentationItem,
  options?: { navigate?: boolean }
) {
  selectPreviewItem(item, { navigate: options?.navigate })
  const renderData = toPresentationRenderData(item)
  commitRenderDataToLive(renderData)
}

export function presentVerse(verse: Verse, options?: { navigate?: boolean }) {
  selectPreviewVerse(verse, { navigate: options?.navigate })
  commitVerseToLive(verse, { makeLive: true })
}

export function previewVerseAndMaybeAutoLive(
  verse: Verse,
  options?: {
    navigate?: boolean
    autoLive?: boolean
  }
) {
  const broadcast = useBroadcastStore.getState()

  // Auto-live turns the live output on (and keeps it following) when the
  // operator has the auto-live toggle enabled.
  if (options?.autoLive && broadcast.readingModeAutoLive) {
    recordWorkflowTrace("live.auto_commit", "Auto-live committed verse live", {
      liveWasOn: broadcast.isLive,
      readingModeAutoLive: broadcast.readingModeAutoLive,
      verse: traceVerseDetails(verse),
    })
    commitVerseToLive(verse, { makeLive: true })
  }

  selectPreviewVerse(verse, { navigate: options?.navigate })
}

export function egwReference(p: EgwParagraph): string {
  return `${p.book_title} ${p.chapter}:${p.paragraph}`
}

function splitEgwTextForSlides(text: string): { text: string }[] {
  return splitTextForReadableSlides(text, {
    maxChars: 150,
    softChars: 125,
  }).map((chunk) => ({ text: chunk }))
}

export function createEgwDeckItems(p: EgwParagraph): EgwPresentationItemData[] {
  const segments = splitEgwTextForSlides(p.text)
  const baseReference = egwReference(p)

  return segments.map((segment, index) => ({
    kind: "egw" as const,
    paragraph: p,
    reference:
      segments.length > 1
        ? `${baseReference} (${index + 1}/${segments.length})`
        : baseReference,
    segments: [segment],
    slideId: `egw-${p.id}-${index}`,
    slideIndex: index,
    slideCount: segments.length,
  }))
}

export function createEgwPresentationItem(
  p: EgwParagraph
): EgwPresentationItemData {
  return createEgwDeckItems(p)[0]!
}

function loadEgwDeck(p: EgwParagraph, activeIndex = 0) {
  const deck = createEgwDeckItems(p)
  useEgwSlideStore.getState().setDeck(deck, activeIndex)
  return deck
}

export function createEgwQueueItem(
  p: EgwParagraph,
  options?: {
    confidence?: number
    source?: QueueItem["source"]
  }
): QueueItem {
  return {
    id: crypto.randomUUID(),
    presentation: createEgwPresentationItem(p),
    confidence: options?.confidence ?? 1,
    source: options?.source ?? "manual",
    added_at: Date.now(),
  }
}

export function previewEgwParagraph(p: EgwParagraph) {
  const deck = loadEgwDeck(p, 0)
  const first = deck[0]
  if (first) selectPreviewItem(first)
}

export function presentEgwParagraph(p: EgwParagraph) {
  const deck = loadEgwDeck(p, 0)
  const first = deck[0]
  if (first) presentItem(first)
}
