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
import {
  getPresentationRenderData,
  getScriptureVerse,
} from "@/types"

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

export function createPresentationItem(verse: Verse, reference?: string): ScripturePresentationItemData {
  return {
    kind: "scripture",
    verse,
    reference: reference ?? `${verse.book_name} ${verse.chapter}:${verse.verse}`,
  }
}

export function createScriptureQueueItem(
  verse: Verse,
  options?: {
    reference?: string
    confidence?: number
    source?: QueueItem["source"]
    is_chapter_only?: boolean
  },
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

export function selectPreviewVerse(verse: Verse, options?: { navigate?: boolean }) {
  const item = createPresentationItem(verse)
  const renderData = toScriptureRenderData(item)
  useBroadcastStore.getState().setPreviewItem(renderData)
  bibleActions.selectVerse(verse)

  if (options?.navigate && verse.book_number > 0) {
    bibleActions.navigateToVerse(
      verse.book_number,
      verse.chapter,
      verse.verse,
    )
  }
}

export function selectPreviewItem(item: PresentationItem, options?: { navigate?: boolean }) {
  const verse = getScriptureVerse(item)
  useBroadcastStore.getState().setPreviewItem(toPresentationRenderData(item))

  if (verse) {
    bibleActions.selectVerse(verse)
    if (options?.navigate && verse.book_number > 0) {
      bibleActions.navigateToVerse(
        verse.book_number,
        verse.chapter,
        verse.verse,
      )
    }
  }
}

function toScriptureRenderData(item: ScripturePresentationItemData): PresentationRenderData {
  return toVerseRenderData(item.verse, activeTranslationLabel())
}

function toPresentationRenderData(item: PresentationItem): PresentationRenderData {
  if (item.kind === "scripture") return toScriptureRenderData(item)
  return getPresentationRenderData(item)
}

function commitRenderDataToLive(
  renderData: PresentationRenderData,
  options?: { makeLive?: boolean },
) {
  console.info("[pipeline] commit_live", { reference: renderData.reference })
  useBroadcastStore.getState().commitLiveItem(renderData, options)
}

export function commitVerseToLive(verse: Verse, options?: { makeLive?: boolean }) {
  const renderData = toPresentationRenderData(createPresentationItem(verse))
  commitRenderDataToLive(renderData, options)
}

export function commitPreviewToLive(): boolean {
  const previewItem =
    useBroadcastStore.getState().previewItem ??
    (() => {
      const verse = useBibleStore.getState().selectedVerse
      return verse ? toPresentationRenderData(createPresentationItem(verse)) : null
    })()
  if (!previewItem) return false

  commitRenderDataToLive(previewItem)
  return true
}

export function presentItem(item: PresentationItem, options?: { navigate?: boolean }) {
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
    autoLiveWhenAlreadyOn?: boolean
  },
) {
  const broadcast = useBroadcastStore.getState()
  const shouldAutoLive =
    options?.autoLiveWhenAlreadyOn &&
    broadcast.isLive &&
    broadcast.readingModeAutoLive

  if (shouldAutoLive) {
    commitVerseToLive(verse, { makeLive: false })
  }

  selectPreviewVerse(verse, { navigate: options?.navigate })
  console.info("[pipeline] preview", { reference: `${verse.book_name} ${verse.chapter}:${verse.verse}` })
}

export function egwReference(p: EgwParagraph): string {
  return `${p.book_title} ${p.chapter}:${p.paragraph}`
}

function splitEgwTextForSlides(text: string): { text: string }[] {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (!normalized) return [{ text: "" }]

  const sentences = normalized.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [normalized]
  const chunks: string[] = []
  let current = ""

  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (!trimmed) continue
    const next = current ? `${current} ${trimmed}` : trimmed

    if (current && next.length > 230) {
      chunks.push(current)
      current = trimmed
    } else {
      current = next
    }
  }

  if (current) chunks.push(current)
  return (chunks.length > 0 ? chunks : [normalized]).map((chunk) => ({ text: chunk }))
}

export function createEgwPresentationItem(p: EgwParagraph): EgwPresentationItemData {
  return {
    kind: "egw",
    paragraph: p,
    reference: egwReference(p),
    segments: splitEgwTextForSlides(p.text),
  }
}

export function createEgwQueueItem(p: EgwParagraph): QueueItem {
  return {
    id: crypto.randomUUID(),
    presentation: createEgwPresentationItem(p),
    confidence: 1,
    source: "manual",
    added_at: Date.now(),
  }
}

export function previewEgwParagraph(p: EgwParagraph) {
  selectPreviewItem(createEgwPresentationItem(p))
}

export function presentEgwParagraph(p: EgwParagraph) {
  presentItem(createEgwPresentationItem(p))
}
