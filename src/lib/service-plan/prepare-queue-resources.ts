import { bibleActions } from "@/hooks/use-bible"
import { createScriptureQueueItem } from "@/lib/presentation-workflow"
import {
  createGroupedHymnQueueItems,
  defaultSelectedSectionIds,
} from "@/services/hymnal/hymn-presentation"
import { generateHymnScreens } from "@/services/hymnal/generate-hymn-screens"
import { getHymnByNumber } from "@/services/hymnal/hymnal-repository"
import { buildSermonSlideDeck } from "@/services/slides/sermon-slide-deck"
import { useBibleStore } from "@/stores/bible-store"
import { useQueueStore } from "@/stores/queue-store"
import type { QueueItem } from "@/types/queue"
import type { PresentationItem } from "@/types/presentation"
import type { MediaRef, ServiceAttachment, ServiceItem, ScriptureRef } from "@/types/service-plan"
import type { Verse } from "@/types"

const PLAN_PREFIX = "[Plan]"

function planReference(label: string): string {
  return label.startsWith(`${PLAN_PREFIX} `) ? label : `${PLAN_PREFIX} ${label}`
}

function createPlaceholderScripturePresentation(
  label: string,
  detail: string,
): PresentationItem {
  const translationId = useBibleStore.getState().activeTranslationId
  const verse: Verse = {
    id: 0,
    translation_id: translationId,
    book_number: 0,
    book_name: "Service Plan",
    book_abbreviation: "Plan",
    chapter: 0,
    verse: 0,
    text: detail,
  }
  return {
    kind: "scripture",
    verse,
    reference: planReference(label),
  }
}

function createMediaPresentation(
  input: Pick<ServiceAttachment, "id" | "kind" | "label"> | MediaRef,
  kind: "media" | "document",
): PresentationItem {
  const title = input.label
  const kindLabel = kind === "document" ? "Document" : "Media"
  return {
    kind: "media",
    mediaId: "id" in input ? input.id : input.attachmentId,
    mediaKind: kind,
    title,
    reference: planReference(`${kindLabel} - ${title}`),
    segments: [
      {
        text:
          kind === "document"
            ? "Prepared document attachment. Open from the Service Plan to preview."
            : "Prepared media attachment. Open from the Service Plan to preview the selected file.",
      },
    ],
  }
}

async function resolveScriptureRef(ref: ScriptureRef): Promise<Verse | null> {
  if (!ref.chapter) return null

  let books = useBibleStore.getState().books
  if (books.length === 0) {
    books = await bibleActions.loadBooks()
  }

  const bookQuery = (ref.book ?? ref.reference ?? "").trim().toLowerCase()
  if (!bookQuery) return null

  const book = books.find(
    (candidate) =>
      candidate.name.toLowerCase() === bookQuery ||
      candidate.abbreviation.toLowerCase() === bookQuery,
  )
  if (!book) return null

  const verseNumber = ref.verse ?? 1
  return bibleActions.fetchVerse(book.book_number, ref.chapter, verseNumber)
}

function queuePreparedItem(
  presentation: PresentationItem,
  hymnGroup?: QueueItem["hymnGroup"],
): void {
  const item: QueueItem = {
    id: crypto.randomUUID(),
    presentation: {
      ...presentation,
      reference: planReference(presentation.reference),
    },
    confidence: 1,
    source: "service-plan",
    added_at: Date.now(),
    hymnGroup,
  }
  useQueueStore.getState().addItem(item)
}

export async function enqueuePreparedResourcesForItem(item: ServiceItem): Promise<number> {
  let queued = 0

  for (const hymnRef of item.hymnRefs) {
    if (!hymnRef.hymnNumber) continue
    try {
      const hymn = await getHymnByNumber(hymnRef.hymnNumber)
      if (!hymn) continue
      const screens = generateHymnScreens({
        hymn,
        selectedSectionIds: defaultSelectedSectionIds(hymn),
        maxLinesPerScreen: 4,
      })
      const groupItems = createGroupedHymnQueueItems(screens)
      for (const queueItem of groupItems) {
        queuePreparedItem(queueItem.presentation, queueItem.hymnGroup)
        queued += 1
      }
    } catch {
      // Failed hymn loads must not block other resources.
    }
  }

  for (const scriptureRef of item.scriptureRefs) {
    try {
      const verse = await resolveScriptureRef(scriptureRef)
      if (verse) {
        const queueItem = createScriptureQueueItem(verse, {
          reference:
            scriptureRef.reference ??
            `${verse.book_name} ${verse.chapter}:${verse.verse}`,
          source: "service-plan",
        })
        queuePreparedItem(queueItem.presentation)
        queued += 1
        continue
      }

      const label =
        scriptureRef.reference ??
        [scriptureRef.book, scriptureRef.chapter, scriptureRef.verse].filter(Boolean).join(" ")
      if (!label) continue
      queuePreparedItem(
        createPlaceholderScripturePresentation(label, "Scripture reference pending lookup."),
      )
      queued += 1
    } catch {
      // Keep going when one scripture ref fails.
    }
  }

  for (const media of item.mediaRefs) {
    queuePreparedItem(createMediaPresentation(media, "media"))
    queued += 1
  }

  const slideDeck = buildSermonSlideDeck(item)
  for (const attachment of item.attachments) {
    if (attachment.kind === "slide") {
      const slide = slideDeck.find((s) => s.slideId === attachment.id)
      if (slide) {
        queuePreparedItem(slide)
        queued += 1
      }
    } else if (attachment.kind === "deck" || attachment.kind === "document") {
      queuePreparedItem(createMediaPresentation(attachment, "document"))
      queued += 1
    }
  }

  return queued
}
