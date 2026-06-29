/**
 * Dev-only demo seed for screenshots / visual review.
 *
 * No-op unless running the Vite dev server (`import.meta.env.DEV`) with `?demo`
 * in the URL — e.g. http://localhost:3000/?demo=1. When active it bypasses the
 * verification gate and fills the stores with representative content so the
 * controller renders like a live Sabbath service. The guard short-circuits
 * before any store is touched, and the module is tree-shaken out of production
 * builds, so it can never affect real data.
 */
import type {
  DetectionResult,
  QueueItem,
  ScripturePresentationItemData,
  TranscriptSegment,
  Verse,
} from "@/types"
import { getPresentationRenderData } from "@/types"
import { useBroadcastLiveStore as useBroadcastStore } from "@/stores/broadcast/live-store"
import { useDetectionStore } from "@/stores/detection-store"
import { useQueueStore } from "@/stores/queue-store"
import { useSettingsStore } from "@/stores/settings-store"
import { useTranscriptStore } from "@/stores/transcript-store"
import { useTutorialStore } from "@/stores/tutorial-store"
import { useVerificationStore } from "@/stores/verification-store"

export function isDemoRequested(): boolean {
  if (!import.meta.env.DEV) return false
  if (typeof window === "undefined") return false
  return new URLSearchParams(window.location.search).has("demo")
}

function makeVerse(
  partial: Pick<
    Verse,
    "book_name" | "book_abbreviation" | "book_number" | "chapter" | "verse" | "text"
  >
): Verse {
  return {
    id: partial.book_number * 1_000_000 + partial.chapter * 1000 + partial.verse,
    translation_id: 1,
    ...partial,
  }
}

function scripture(v: Verse): ScripturePresentationItemData {
  return {
    kind: "scripture",
    verse: v,
    reference: `${v.book_name} ${v.chapter}:${v.verse}`,
  }
}

const JOHN_316 = makeVerse({
  book_name: "John",
  book_abbreviation: "John",
  book_number: 43,
  chapter: 3,
  verse: 16,
  text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
})

const ROMANS_58 = makeVerse({
  book_name: "Romans",
  book_abbreviation: "Rom",
  book_number: 45,
  chapter: 5,
  verse: 8,
  text: "But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us.",
})

const JOHN1_49 = makeVerse({
  book_name: "1 John",
  book_abbreviation: "1John",
  book_number: 62,
  chapter: 4,
  verse: 9,
  text: "In this was manifested the love of God toward us, because that God sent his only begotten Son into the world, that we might live through him.",
})

function segment(text: string, secondsAgo: number): TranscriptSegment {
  return {
    id: `demo-seg-${secondsAgo}`,
    text,
    is_final: true,
    confidence: 0.96,
    words: [],
    timestamp: Date.now() - secondsAgo * 1000,
  }
}

function detection(
  v: Verse,
  source: DetectionResult["source"],
  snippet: string,
  confidence: number
): DetectionResult {
  return {
    content_type: "bible",
    verse_ref: `${v.book_name} ${v.chapter}:${v.verse}`,
    verse_text: v.text,
    book_name: v.book_name,
    book_number: v.book_number,
    chapter: v.chapter,
    verse: v.verse,
    confidence,
    source,
    auto_queued: false,
    transcript_snippet: snippet,
    is_chapter_only: false,
    egw_paragraph: null,
  }
}

function queueItem(
  v: Verse,
  source: QueueItem["source"],
  confidence: number,
  addedSecondsAgo: number
): QueueItem {
  return {
    id: `demo-q-${v.book_number}-${v.chapter}-${v.verse}`,
    presentation: scripture(v),
    confidence,
    source,
    added_at: Date.now() - addedSecondsAgo * 1000,
  }
}

export function maybeSeedDemoState(): void {
  if (!isDemoRequested()) return

  useVerificationStore.setState({
    status: "verified",
    verifiedEmail: "demo@sabbathcue.app",
    isHydrated: true,
    error: null,
    errorCode: null,
  })

  // Suppress the first-run tutorial overlay so the desk is unobstructed.
  useSettingsStore.setState({ onboardingComplete: true })
  useTutorialStore.setState({ isRunning: false })

  useTranscriptStore.setState({
    isTranscribing: true,
    connectionStatus: "connected",
    currentPartial: "Let us consider three truths from this passage…",
    segments: [
      segment(
        "Good morning, church family. It's a blessing to be with you today as we open God's Word together.",
        41
      ),
      segment(
        "Our passage this morning is found in the Gospel of John, chapter 3, verse 16.",
        34
      ),
      segment(
        "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
        27
      ),
      segment(
        "This verse is perhaps the most well-known in all of Scripture, and it reminds us of the incredible love of our Savior.",
        15
      ),
    ],
  })

  useDetectionStore
    .getState()
    .setDetections([
      detection(JOHN_316, "direct", "…the Gospel of John, chapter 3, verse 16…", 0.99),
      detection(ROMANS_58, "semantic", "…the incredible love of our Savior…", 0.82),
      detection(JOHN1_49, "semantic", "…the love of God toward us…", 0.78),
    ])

  useQueueStore.getState().addItems([
    queueItem(JOHN_316, "ai-direct", 0.99, 150),
    queueItem(ROMANS_58, "manual", 1, 95),
    queueItem(JOHN1_49, "ai-semantic", 0.78, 50),
  ])

  const render = getPresentationRenderData(scripture(JOHN_316))
  useBroadcastStore.getState().setPreviewItem(render)
  useBroadcastStore.getState().setLiveItem(render)
}
