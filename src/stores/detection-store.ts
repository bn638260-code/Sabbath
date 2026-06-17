import { create } from "zustand"
import type { DetectionResult } from "@/types"

interface DetectionWithMeta {
  detection: DetectionResult
  received_at: number
}

interface DetectionResultWithMeta extends DetectionResult {
  received_at?: number
}

const MAX_RECENT_DETECTIONS = 5
const MAX_RECENCY_BONUS = 0.01
const RECENCY_BONUS_WINDOW_MS = 30_000
const NUMBER_TOKEN_PATTERN = /\d+/g
const VERSE_REF_PATTERN = /(\d+)\s*:\s*(\d+)/g

interface DetectionState {
  detections: DetectionResultWithMeta[]

  addDetection: (detection: DetectionResult) => void
  addDetections: (detections: DetectionResult[]) => void
  setDetections: (detections: DetectionResult[]) => void
  removeDetection: (verseRef: string) => void
  clearDetections: () => void
}

function detectionRank(detection: DetectionResultWithMeta, now: number): number {
  const receivedAt = detection.received_at ?? 0
  const ageMs = Math.max(0, now - receivedAt)
  const recencyBonus =
    receivedAt > 0
      ? Math.max(0, MAX_RECENCY_BONUS * (1 - ageMs / RECENCY_BONUS_WINDOW_MS))
      : 0

  return detection.confidence + recencyBonus
}

function sourcePriority(detection: DetectionResultWithMeta): number {
  return detection.source === "direct" ? 1 : 0
}

function compareDetections(
  a: DetectionResultWithMeta,
  b: DetectionResultWithMeta,
  now: number,
): number {
  const sourceDiff = sourcePriority(b) - sourcePriority(a)
  if (sourceDiff !== 0) return sourceDiff

  const rankDiff = detectionRank(b, now) - detectionRank(a, now)
  if (Math.abs(rankDiff) > Number.EPSILON) return rankDiff

  const aTime = a.received_at ?? 0
  const bTime = b.received_at ?? 0
  if (bTime !== aTime) return bTime - aTime

  return b.confidence - a.confidence
}

function mergeDetection(
  existing: DetectionResult,
  incoming: DetectionResult,
): DetectionResult {
  const preferred = incoming.source === "direct" || existing.source !== "direct" ? incoming : existing
  const fallback = preferred === incoming ? existing : incoming

  return {
    ...preferred,
    confidence: Math.max(existing.confidence, incoming.confidence),
    source: existing.source === "direct" || incoming.source === "direct" ? "direct" : "semantic",
    verse_text: incoming.verse_text.length > 0 ? incoming.verse_text : existing.verse_text,
    transcript_snippet:
      incoming.transcript_snippet.length > 0
        ? incoming.transcript_snippet
        : existing.transcript_snippet,
    auto_queued: existing.auto_queued || incoming.auto_queued,
    is_chapter_only: existing.is_chapter_only && incoming.is_chapter_only,
    book_name: preferred.book_name || fallback.book_name,
    // 0 is the "unresolved" sentinel — only use the preferred value when it is non-zero.
    book_number: preferred.book_number !== 0 ? preferred.book_number : fallback.book_number,
    chapter: preferred.chapter !== 0 ? preferred.chapter : fallback.chapter,
    verse: preferred.verse !== 0 ? preferred.verse : fallback.verse,
  }
}

function normalizeVerseRef(verseRef: string): string {
  return verseRef
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*:\s*/g, ":")
    .trim()
}

function numberTokenMatches(value: string, target: number): boolean {
  NUMBER_TOKEN_PATTERN.lastIndex = 0
  return [...value.matchAll(NUMBER_TOKEN_PATTERN)].some(
    ([token]) => Number(token) === target,
  )
}

function verseRefMatches(value: string, chapter: number, verse: number): boolean {
  VERSE_REF_PATTERN.lastIndex = 0
  return [...value.matchAll(VERSE_REF_PATTERN)].some(
    ([, refChapter, refVerse]) =>
      Number(refChapter) === chapter && Number(refVerse) === verse,
  )
}

function detectionKey(detection: DetectionResult): string {
  const normalizedRef = normalizeVerseRef(detection.verse_ref)

  if (
    detection.book_number > 0 &&
    detection.chapter > 0 &&
    (detection.is_chapter_only
      ? numberTokenMatches(normalizedRef, detection.chapter)
      : verseRefMatches(normalizedRef, detection.chapter, detection.verse))
  ) {
    if (detection.is_chapter_only) {
      return `chapter:${detection.book_number}:${detection.chapter}`
    }
    if (detection.verse > 0) {
      return `verse:${detection.book_number}:${detection.chapter}:${detection.verse}`
    }
  }

  return `ref:${normalizedRef}`
}

function detectionMatchesRemovalKey(detection: DetectionResult, key: string): boolean {
  return (
    detectionKey(detection) === key ||
    detection.verse_ref === key ||
    normalizeVerseRef(detection.verse_ref) === normalizeVerseRef(key)
  )
}

function detectionsAreEquivalent(a: DetectionResult, b: DetectionResult): boolean {
  return (
    detectionKey(a) === detectionKey(b) ||
    normalizeVerseRef(a.verse_ref) === normalizeVerseRef(b.verse_ref)
  )
}

function findMapEntryKey(
  map: Map<string, DetectionWithMeta>,
  detection: DetectionResult,
): string | undefined {
  for (const [key, item] of map) {
    if (detectionsAreEquivalent(item.detection, detection)) {
      return key
    }
  }
  return undefined
}

function withReceivedAt(
  detection: DetectionResult,
  fallback = 0,
): DetectionResultWithMeta {
  return {
    ...detection,
    received_at:
      "received_at" in detection && typeof detection.received_at === "number"
        ? detection.received_at
        : fallback,
  }
}

export const useDetectionStore = create<DetectionState>((set) => ({
  detections: [],

  addDetection: (detection) =>
    set((state) => {
      const now = Date.now()
      const existingIndex = state.detections.findIndex((d) =>
        detectionsAreEquivalent(d, detection)
      )
      
      if (existingIndex >= 0) {
        const existing = withReceivedAt(state.detections[existingIndex])
        const updated: DetectionResultWithMeta = {
          ...mergeDetection(existing, detection),
          received_at: now,
        }
        const newDetections = [...state.detections]
        newDetections[existingIndex] = updated
        newDetections.sort((a, b) => compareDetections(a, b, now))
        return { detections: newDetections.slice(0, MAX_RECENT_DETECTIONS) }
      }
      
      // New detection
      const withMeta: DetectionResultWithMeta = { ...detection, received_at: now }
      const newDetections = [withMeta, ...state.detections]
      newDetections.sort((a, b) => compareDetections(a, b, now))
      return { detections: newDetections.slice(0, MAX_RECENT_DETECTIONS) }
    }),
  addDetections: (incoming) =>
    set((state) => {
      const now = Date.now()
      const map = new Map<string, DetectionWithMeta>()
      
      // Add incoming with received_at
      for (const d of incoming) {
        const key = findMapEntryKey(map, d) ?? detectionKey(d)
        const existing = map.get(key)
        if (!existing) {
          map.set(key, { detection: d, received_at: now })
        } else {
          map.set(key, {
            detection: mergeDetection(existing.detection, d),
            received_at: now,
          })
        }
      }
      
      // Merge existing detections
      for (const d of state.detections) {
        const key = findMapEntryKey(map, d) ?? detectionKey(d)
        const existing = map.get(key)
        const dWithMeta = withReceivedAt(d)
        const dReceivedAt = dWithMeta.received_at ?? 0
        if (!existing) {
          map.set(key, { detection: dWithMeta, received_at: dReceivedAt })
        } else {
          map.set(key, {
            detection: mergeDetection(d, existing.detection),
            received_at: Math.max(existing.received_at, dReceivedAt),
          })
        }
      }
      
      const sorted = [...map.values()]
        .sort((a, b) =>
          compareDetections(
            { ...a.detection, received_at: a.received_at },
            { ...b.detection, received_at: b.received_at },
            now,
          )
        )
        .map((item) => ({ ...item.detection, received_at: item.received_at }))
        .slice(0, MAX_RECENT_DETECTIONS)
      
      return { detections: sorted }
    }),
  setDetections: (detections) =>
    set({
      detections: detections.map((detection) => withReceivedAt(detection)),
    }),
  removeDetection: (key) =>
    set((state) => {
      return {
        detections: state.detections.filter((d) => !detectionMatchesRemovalKey(d, key)),
      }
    }),
  clearDetections: () => set({ detections: [] }),
}))
