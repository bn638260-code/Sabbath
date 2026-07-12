import { create } from "zustand"
import type { DetectionResult } from "@/types"

export type CollectedDetectionKind = "scripture" | "egw" | "hymn"

export interface CollectedDetection {
  key: string
  kind: CollectedDetectionKind
  reference: string
  text: string
  source: DetectionResult["source"] | "hymn"
  detection: DetectionResult
  firstUsedAt: number
  lastUsedAt: number
  useCount: number
}

interface CollectedDetectionsState {
  items: CollectedDetection[]
  record: (detection: DetectionResult, now?: number) => void
  remove: (key: string) => void
  clear: () => void
}

const MAX_COLLECTED_DETECTIONS = 50

function detectionKind(detection: DetectionResult): CollectedDetectionKind {
  if (detection.content_type === "hymn" && detection.hymn) return "hymn"
  if (detection.content_type === "egw" && detection.egw_paragraph) return "egw"
  return "scripture"
}

function normalizeReference(reference: string): string {
  return reference.trim().toLowerCase().replace(/\s+/g, " ")
}

function collectedKey(detection: DetectionResult): string {
  return `${detectionKind(detection)}:${normalizeReference(detection.verse_ref)}`
}

function displayTextFor(detection: DetectionResult): string {
  if (detection.content_type === "hymn" && detection.hymn?.title) {
    return detection.hymn.title
  }
  return detection.verse_text
}

export const useCollectedDetectionsStore = create<CollectedDetectionsState>(
  (set) => ({
    items: [],
    record: (detection, now = Date.now()) =>
      set((state) => {
        const key = collectedKey(detection)
        const existing = state.items.find((item) => item.key === key)
        if (existing) {
          return {
            items: [
              {
                ...existing,
                detection,
                text: displayTextFor(detection),
                source:
                  detection.content_type === "hymn" ? "hymn" : detection.source,
                lastUsedAt: now,
                useCount: existing.useCount + 1,
              },
              ...state.items.filter((item) => item.key !== key),
            ],
          }
        }

        const item: CollectedDetection = {
          key,
          kind: detectionKind(detection),
          reference: detection.verse_ref,
          text: displayTextFor(detection),
          source: detection.content_type === "hymn" ? "hymn" : detection.source,
          detection,
          firstUsedAt: now,
          lastUsedAt: now,
          useCount: 1,
        }

        return {
          items: [item, ...state.items].slice(0, MAX_COLLECTED_DETECTIONS),
        }
      }),
    remove: (key) =>
      set((state) => ({
        items: state.items.filter((item) => item.key !== key),
      })),
    clear: () => set({ items: [] }),
  })
)
