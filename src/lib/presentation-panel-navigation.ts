import { bibleActions } from "@/hooks/use-bible"
import { egwActions } from "@/hooks/use-egw"
import {
  presentItem,
  presentVerse,
  previewEgwParagraph,
  presentEgwParagraph,
  selectPreviewVerse,
  selectPreviewItem,
} from "@/lib/presentation-workflow"
import {
  presentQueuedItem,
  presentQueuedItemAtEnd,
} from "@/lib/queue-presentation"
import { restoreQueuedHymnDeckForRenderItem } from "@/lib/queued-hymn-deck"
import { useBibleStore } from "@/stores/bible-store"
import { getBroadcastLiveStore } from "@/stores/broadcast/live-store"
import { useEgwSlideStore } from "@/stores/egw-slide-store"
import { useEgwStore } from "@/stores/egw-store"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useQueueStore } from "@/stores/queue-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import {
  clampDeckIndex,
  egwDeckSlides,
  findDeckIndex,
  hymnDeckSlides,
  presentationDeckKind,
  presentationDeckSlideId,
  sermonDeckSlides,
  type PresentationDeckSlide,
} from "@/lib/presentation-deck-navigation"
import type { KeyboardEvent } from "react"
import { getVerseFromItem } from "@/types"
import type {
  EgwParagraph,
  PresentationRenderData,
  QueueItem,
  Verse,
} from "@/types"

export function isPresentationNavigationEditableTarget(
  target: EventTarget | null
): boolean {
  if (!(target instanceof HTMLElement)) return false

  if (target.isContentEditable) return true

  const tagName = target.tagName.toLowerCase()
  if (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  ) {
    return true
  }

  // Skip arrow-nav when a list/menu option is focused (e.g. an open dropdown)
  // so arrows drive the list, not presentation. Buttons are excluded on
  // purpose: they don't consume arrow keys, and guarding them would kill
  // keyboard nav whenever a button is focused (after clicking the on-screen
  // arrow controls or any toolbar button).
  return Boolean(
    target.closest(
      '[contenteditable="true"], input, textarea, select, [role="textbox"], [role="combobox"], [role="spinbutton"], [role="menuitem"], [role="option"]'
    )
  )
}

function presentOrPreview(
  next: Parameters<typeof presentItem>[0],
  isLive: boolean
): void {
  if (isLive) presentItem(next)
  else selectPreviewItem(next)
}

function scriptureFromTarget(
  targetItem: PresentationRenderData | null
): Verse | null {
  if (targetItem?.kind !== "scripture") return null
  return targetItem.scripture ?? useBibleStore.getState().selectedVerse
}

// Serializes async scripture/EGW navigation. Each queued advance runs only
// after the previous one resolves and re-reads the *current* verse/paragraph
// from the store, so two rapid ArrowRight presses go n -> n+1 -> n+2 instead
// of both resolving from the same stale snapshot.
let navigationChain: Promise<void> = Promise.resolve()

function chainNavigation(work: () => Promise<void>): void {
  navigationChain = navigationChain
    .then(work)
    .catch((error) => {
      console.warn("[keyboard] navigation failed", error)
    })
}

function currentScripture(
  isLive: boolean,
  targetItem: PresentationRenderData | null
): Verse | null {
  if (isLive) {
    const live = getBroadcastLiveStore().liveItem
    const liveVerse = live?.kind === "scripture" ? (live.scripture ?? null) : null
    return liveVerse ?? scriptureFromTarget(targetItem)
  }
  return useBibleStore.getState().selectedVerse ?? scriptureFromTarget(targetItem)
}

function findAdjacentVerse(
  current: Verse,
  verses: Verse[],
  delta: number
): Verse | null {
  const currentIndex = verses.findIndex(
    (verse) =>
      verse.book_number === current.book_number &&
      verse.chapter === current.chapter &&
      verse.verse === current.verse
  )
  if (currentIndex < 0) return null
  const next = verses[currentIndex + delta]
  if (!next) return null
  if (
    next.book_number !== current.book_number ||
    next.chapter !== current.chapter
  ) {
    return null
  }
  return next
}

async function advanceScripture(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean
): Promise<void> {
  const current = currentScripture(isLive, targetItem)
  if (!current) return

  const bible = useBibleStore.getState()
  let chapter = bible.currentChapter.filter(
    (verse) =>
      verse.book_number === current.book_number &&
      verse.chapter === current.chapter
  )

  if (chapter.length === 0) {
    chapter = await bibleActions.loadChapter(
      current.book_number,
      current.chapter,
      current.translation_id
    )
  }

  const next =
    findAdjacentVerse(current, chapter, delta) ??
    (await bibleActions.fetchVerse(
      current.book_number,
      current.chapter,
      current.verse + delta,
      current.translation_id
    ))

  if (!next) return
  if (isLive) presentVerse(next, { navigate: true })
  else selectPreviewVerse(next, { navigate: true })
}

function queueScriptureAdvance(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean
): boolean {
  if (!scriptureFromTarget(targetItem)) return false
  chainNavigation(() => advanceScripture(delta, targetItem, isLive))
  return true
}

function egwParagraphFromTarget(
  targetItem: PresentationRenderData | null
): EgwParagraph | null {
  if (targetItem?.kind !== "egw") return null
  if (targetItem.egwParagraph) return targetItem.egwParagraph

  const egwSlides = useEgwSlideStore.getState()
  return egwSlides.deck[egwSlides.activeIndex]?.paragraph ?? null
}

// Re-reads the active paragraph from the slide deck so chained advances
// continue from where the previous one landed, not the keydown snapshot.
function currentEgwParagraph(
  targetItem: PresentationRenderData | null
): EgwParagraph | null {
  const egwSlides = useEgwSlideStore.getState()
  return (
    egwSlides.deck[egwSlides.activeIndex]?.paragraph ??
    egwParagraphFromTarget(targetItem)
  )
}

function findAdjacentEgwParagraph(
  current: EgwParagraph,
  paragraphs: EgwParagraph[],
  delta: number
): EgwParagraph | null {
  const currentIndex = paragraphs.findIndex(
    (paragraph) =>
      paragraph.id === current.id ||
      (paragraph.book_number === current.book_number &&
        paragraph.page === current.page &&
        paragraph.page_paragraph === current.page_paragraph)
  )
  if (currentIndex < 0) return null
  const next = paragraphs[currentIndex + delta]
  if (!next) return null
  if (
    next.book_number !== current.book_number ||
    next.page !== current.page
  ) {
    return null
  }
  return next
}

async function advanceEgwParagraph(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean
): Promise<void> {
  const current = currentEgwParagraph(targetItem)
  if (!current) return

  let paragraphs = useEgwStore
    .getState()
    .currentParagraphs.filter(
      (paragraph) =>
        paragraph.book_number === current.book_number &&
        paragraph.page === current.page
    )

  if (paragraphs.length === 0) {
    paragraphs = await egwActions.loadPage(
      current.book_number,
      current.page
    )
  }

  const next = findAdjacentEgwParagraph(current, paragraphs, delta)
  if (!next) return
  if (isLive) presentEgwParagraph(next)
  else previewEgwParagraph(next)
}

function queueEgwParagraphAdvance(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean
): boolean {
  if (!egwParagraphFromTarget(targetItem)) return false
  chainNavigation(() => advanceEgwParagraph(delta, targetItem, isLive))
  return true
}

// PowerPoint-style queue walk: when live and already at the boundary slide of
// the current item, cross into the adjacent queue item — its FIRST slide going
// forward, its LAST slide going backward. Only fires when the live content
// actually corresponds to the active queue item (matchesActive), and never
// wraps around either end of the queue.
//
// Returns `undefined` (not `false`) when the walk does not apply, so callers
// using `?? stopAtBoundary` fall through to their kind's default boundary
// behavior (hymn/sermon consume the key; EGW falls to paragraph navigation).
function advanceQueueAtBoundary(
  delta: number,
  isLive: boolean,
  matchesActive: (item: QueueItem) => boolean
): boolean | undefined {
  if (!isLive) return undefined
  const queue = useQueueStore.getState()
  if (queue.activeIndex === null) return undefined
  const active = queue.items[queue.activeIndex]
  if (!active || !matchesActive(active)) return undefined

  const nextIndex = queue.activeIndex + delta
  const next = queue.items[nextIndex]
  if (!next) return true // at either end of the queue: consume the key, no wrap

  queue.setActive(nextIndex)
  if (delta < 0) presentQueuedItemAtEnd(next)
  else presentQueuedItem(next)
  return true
}

function advanceLiveHymnGroup(delta: number): boolean {
  const queue = useQueueStore.getState()
  const activeQueueItem =
    queue.activeIndex === null ? null : (queue.items[queue.activeIndex] ?? null)

  if (
    activeQueueItem?.presentation.kind === "hymn" &&
    activeQueueItem.hymnGroup
  ) {
    const activeGroup = activeQueueItem.hymnGroup
    const targetItemIndex = activeGroup.itemIndex + delta
    const targetQueueIndex = queue.items.findIndex((item) => {
      const group = item.hymnGroup
      return (
        item.presentation.kind === "hymn" &&
        group?.groupId === activeGroup.groupId &&
        group.itemIndex === targetItemIndex
      )
    })
    const target = queue.items[targetQueueIndex]
    if (target) {
      queue.setActive(targetQueueIndex)
      presentQueuedItem(target)
      return true
    }
  }
  return false
}

// Shared deck-advance math for hymn/EGW/sermon decks. They differ only in the
// backing store, how setDeck is called, and what to return when already at the
// boundary (hymn/sermon stop; EGW falls through to adjacent-paragraph nav).
function advanceDeck<T extends Parameters<typeof presentItem>[0]>(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean,
  config: {
    rawDeck: T[]
    slides: PresentationDeckSlide[]
    activeIndex: number
    setActive: (nextIndex: number) => void
    stopAtBoundary: boolean
    onBoundary?: () => boolean | undefined
  }
): boolean {
  if (config.rawDeck.length === 0) return false
  const currentIndex = findDeckIndex(
    config.slides,
    presentationDeckSlideId(targetItem),
    config.activeIndex
  )
  const nextIndex = clampDeckIndex(config.slides.length, currentIndex, delta)
  const next = config.rawDeck[nextIndex]
  if (!next || nextIndex === currentIndex) {
    return config.onBoundary?.() ?? config.stopAtBoundary
  }
  config.setActive(nextIndex)
  presentOrPreview(next, isLive)
  return true
}

function advanceHymnDeck(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean
): boolean {
  restoreQueuedHymnDeckForRenderItem(targetItem)
  const hymnSlides = useHymnSlideStore.getState()
  return advanceDeck(delta, targetItem, isLive, {
    rawDeck: hymnSlides.deck,
    slides: hymnDeckSlides(hymnSlides.deck),
    activeIndex: hymnSlides.activeIndex,
    setActive: (nextIndex) => hymnSlides.setDeck(hymnSlides.deck, nextIndex),
    stopAtBoundary: true,
    onBoundary: () =>
      advanceQueueAtBoundary(
        delta,
        isLive,
        (item) => item.presentation.kind === "hymn"
      ),
  })
}

function advanceEgwDeck(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean
): boolean {
  const egwSlides = useEgwSlideStore.getState()
  return advanceDeck(delta, targetItem, isLive, {
    rawDeck: egwSlides.deck,
    slides: egwDeckSlides(egwSlides.deck),
    activeIndex: egwSlides.activeIndex,
    setActive: (nextIndex) => egwSlides.setDeck(egwSlides.deck, nextIndex),
    stopAtBoundary: false,
    onBoundary: () =>
      advanceQueueAtBoundary(
        delta,
        isLive,
        (item) =>
          item.presentation.kind === "egw" &&
          item.presentation.paragraph.id ===
            (egwParagraphFromTarget(targetItem)?.id ?? -1)
      ),
  })
}

function advanceSermonDeck(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean
): boolean {
  const sermonSlides = useSermonSlideStore.getState()
  return advanceDeck(delta, targetItem, isLive, {
    rawDeck: sermonSlides.deck,
    slides: sermonDeckSlides(sermonSlides.deck),
    activeIndex: sermonSlides.activeIndex,
    setActive: (nextIndex) =>
      sermonSlides.setDeck(
        sermonSlides.deck,
        nextIndex,
        sermonSlides.activeItemId
      ),
    stopAtBoundary: true,
    onBoundary: () =>
      advanceQueueAtBoundary(
        delta,
        isLive,
        (item) => item.presentation.kind === "slideDeck"
      ),
  })
}

export function advancePresentationTarget(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean
): boolean {
  const deckKind = presentationDeckKind(targetItem)
  if (!deckKind) {
    // Scripture is single-slide, so a live verse that matches the active queue
    // item crosses straight to the adjacent item (no slide-boundary gate).
    // When the live verse does not match (detection-driven flow), fall through
    // to ordinary verse +1/-1 navigation.
    const liveVerse = isLive ? scriptureFromTarget(targetItem) : null
    if (
      liveVerse &&
      advanceQueueAtBoundary(delta, isLive, (item) => {
        const itemVerse = getVerseFromItem(item)
        return (
          itemVerse?.book_number === liveVerse.book_number &&
          itemVerse.chapter === liveVerse.chapter &&
          itemVerse.verse === liveVerse.verse
        )
      })
    ) {
      return true
    }
    return queueScriptureAdvance(delta, targetItem, isLive)
  }

  if (isLive && deckKind === "hymn" && advanceLiveHymnGroup(delta)) {
    return true
  }
  if (deckKind === "hymn") return advanceHymnDeck(delta, targetItem, isLive)
  if (deckKind === "egw") {
    return (
      advanceEgwDeck(delta, targetItem, isLive) ||
      queueEgwParagraphAdvance(delta, targetItem, isLive)
    )
  }
  return advanceSermonDeck(delta, targetItem, isLive)
}

export function advanceCurrentPresentationTarget(delta: number): boolean {
  const broadcast = getBroadcastLiveStore()
  const targetItem = broadcast.isLive
    ? broadcast.liveItem
    : broadcast.previewItem
  return advancePresentationTarget(delta, targetItem, broadcast.isLive)
}

// Shared ArrowLeft/ArrowRight handler for the preview and live panels. The
// panels differ only in which target/live state they resolve, so they pass a
// resolver instead of duplicating the modifier/editable-target guards.
export function handlePresentationPanelArrowKey(
  event: KeyboardEvent<HTMLElement>,
  resolveTarget: () => {
    item: PresentationRenderData | null
    isLive: boolean
  }
): void {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    isPresentationNavigationEditableTarget(event.target)
  ) {
    return
  }

  const delta =
    event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
  if (delta === 0) return

  const { item, isLive } = resolveTarget()
  if (advancePresentationTarget(delta, item, isLive)) {
    event.preventDefault()
  }
}
