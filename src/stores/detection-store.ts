import { create } from "zustand"
import type { DetectionResult } from "@/types"

interface DetectionWithMeta {
  detection: DetectionResult
  received_at: number
}

interface DetectionResultWithMeta extends DetectionResult {
  received_at?: number
}

const MAX_RECENT_DETECTIONS = 8
const DIRECT_SOURCE_BONUS = 0.04
const MAX_RECENCY_BONUS = 0.01
const RECENCY_BONUS_WINDOW_MS = 30_000
const DETECTION_VISIBLE_MS = 5_000

const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>()

interface DetectionState {
  detections: DetectionResult[]
  autoMode: boolean
  confidenceThreshold: number

  addDetection: (detection: DetectionResult) => void
  addDetections: (detections: DetectionResult[]) => void
  setDetections: (detections: DetectionResult[]) => void
  removeDetection: (verseRef: string) => void
  clearDetections: () => void
  setAutoMode: (auto: boolean) => void
  setConfidenceThreshold: (threshold: number) => void
}

function detectionRank(detection: DetectionResultWithMeta, now: number): number {
  const sourceBonus = detection.source === "direct" ? DIRECT_SOURCE_BONUS : 0
  const receivedAt = detection.received_at ?? 0
  const ageMs = Math.max(0, now - receivedAt)
  const recencyBonus =
    receivedAt > 0
      ? Math.max(0, MAX_RECENCY_BONUS * (1 - ageMs / RECENCY_BONUS_WINDOW_MS))
      : 0

  return detection.confidence + sourceBonus + recencyBonus
}

function compareDetections(
  a: DetectionResultWithMeta,
  b: DetectionResultWithMeta,
  now: number,
): number {
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
    verse_text: incoming.verse_text || existing.verse_text,
    transcript_snippet: incoming.transcript_snippet || existing.transcript_snippet,
    auto_queued: existing.auto_queued || incoming.auto_queued,
    is_chapter_only: existing.is_chapter_only && incoming.is_chapter_only,
    book_name: preferred.book_name || fallback.book_name,
    // 0 is the "unresolved" sentinel — only use the preferred value when it is non-zero.
    book_number: preferred.book_number !== 0 ? preferred.book_number : fallback.book_number,
    chapter: preferred.chapter !== 0 ? preferred.chapter : fallback.chapter,
    verse: preferred.verse !== 0 ? preferred.verse : fallback.verse,
  }
}

function clearDetectionExpiry(verseRef: string) {
  const timer = expiryTimers.get(verseRef)
  if (timer) {
    clearTimeout(timer)
    expiryTimers.delete(verseRef)
  }
}

function scheduleDetectionExpiry(
  verseRef: string,
  removeDetection: (verseRef: string) => void,
) {
  clearDetectionExpiry(verseRef)

  const timer = setTimeout(() => {
    expiryTimers.delete(verseRef)
    removeDetection(verseRef)
  }, DETECTION_VISIBLE_MS)

  if (typeof timer === "object" && "unref" in timer && typeof timer.unref === "function") {
    timer.unref()
  }

  expiryTimers.set(verseRef, timer)
}

function clearAllDetectionExpiries() {
  for (const timer of expiryTimers.values()) {
    clearTimeout(timer)
  }
  expiryTimers.clear()
}

export const useDetectionStore = create<DetectionState>((set) => ({
  detections: [],
  autoMode: false,
  confidenceThreshold: 0.8,

  addDetection: (detection) =>
    set((state) => {
      const now = Date.now()
      scheduleDetectionExpiry(detection.verse_ref, useDetectionStore.getState().removeDetection)
      const existingIndex = state.detections.findIndex((d) => d.verse_ref === detection.verse_ref)
      
      if (existingIndex >= 0) {
        const existing = state.detections[existingIndex] as DetectionResultWithMeta
        const updated: DetectionResultWithMeta = {
          ...mergeDetection(existing, detection),
          received_at: now,
        }
        const newDetections = [...state.detections] as DetectionResultWithMeta[]
        newDetections[existingIndex] = updated
        newDetections.sort((a, b) => compareDetections(a, b, now))
        return { detections: newDetections.slice(0, MAX_RECENT_DETECTIONS) as DetectionResult[] }
      }
      
      // New detection
      const withMeta: DetectionResultWithMeta = { ...detection, received_at: now }
      const newDetections = [withMeta, ...state.detections] as DetectionResultWithMeta[]
      newDetections.sort((a, b) => compareDetections(a, b, now))
      return { detections: newDetections.slice(0, MAX_RECENT_DETECTIONS) as DetectionResult[] }
    }),
  addDetections: (incoming) =>
    set((state) => {
      const now = Date.now()
      const map = new Map<string, DetectionWithMeta>()

      for (const detection of incoming) {
        scheduleDetectionExpiry(detection.verse_ref, useDetectionStore.getState().removeDetection)
      }
      
      // Add incoming with received_at
      for (const d of incoming) {
        const existing = map.get(d.verse_ref)
        if (!existing) {
          map.set(d.verse_ref, { detection: d, received_at: now })
        } else {
          map.set(d.verse_ref, {
            detection: mergeDetection(existing.detection, d),
            received_at: now,
          })
        }
      }
      
      // Merge existing detections
      for (const d of state.detections) {
        const existing = map.get(d.verse_ref)
        const dReceivedAt = (d as DetectionResultWithMeta).received_at ?? 0
        if (!existing) {
          map.set(d.verse_ref, { detection: d, received_at: dReceivedAt })
        } else {
          if (d.confidence > existing.detection.confidence || d.source === "direct") {
            map.set(d.verse_ref, {
              detection: mergeDetection(existing.detection, d),
              received_at: Math.max(existing.received_at, dReceivedAt),
            })
          } else if (dReceivedAt > existing.received_at) {
            map.set(d.verse_ref, {
              detection: mergeDetection(d, existing.detection),
              received_at: dReceivedAt,
            })
          } else {
            // Incoming won on confidence, so make it the second arg so
            // mergeDetection's preferred rule picks it. The non-zero sentinel
            // checks for book_number/chapter/verse still fall through to the
            // state detection when the incoming batch is unresolved.
            map.set(d.verse_ref, {
              detection: mergeDetection(d, existing.detection),
              received_at: Math.max(existing.received_at, dReceivedAt),
            })
          }
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
        .map((item) => ({ ...item.detection, received_at: item.received_at } as DetectionResultWithMeta))
        .slice(0, MAX_RECENT_DETECTIONS) as DetectionResult[]
      
      return { detections: sorted }
    }),
  setDetections: (detections) => {
    clearAllDetectionExpiries()
    for (const detection of detections) {
      scheduleDetectionExpiry(detection.verse_ref, useDetectionStore.getState().removeDetection)
    }
    set({ detections })
  },
  removeDetection: (verseRef) =>
    set((state) => {
      clearDetectionExpiry(verseRef)
      return {
        detections: state.detections.filter((d) => d.verse_ref !== verseRef),
      }
    }),
  clearDetections: () => {
    clearAllDetectionExpiries()
    set({ detections: [] })
  },
  setAutoMode: (autoMode) => set({ autoMode }),
  setConfidenceThreshold: (confidenceThreshold) =>
    set({ confidenceThreshold }),
}))
