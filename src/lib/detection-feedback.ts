import type { DetectionResult } from "@/types"

const STORAGE_KEY = "sabbathcue:detection-feedback:v1"
const MAX_ENTRIES = 500

export type DetectionFeedbackAction =
  | "previewed"
  | "presented"
  | "queued"
  | "auto-selected"
  | "dismissed"

export interface DetectionFeedbackEntry {
  reference: string
  source: DetectionResult["source"]
  matchStrength: number
  rankScore: number
  action: DetectionFeedbackAction
  recordedAt: number
}

export function recordDetectionFeedback(
  detection: DetectionResult,
  action: DetectionFeedbackAction
) {
  if (typeof localStorage === "undefined") return

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
    const entries: DetectionFeedbackEntry[] = Array.isArray(stored) ? stored : []
    entries.push({
      reference: detection.verse_ref,
      source: detection.source,
      matchStrength: detection.confidence,
      rankScore: detection.rank_score ?? detection.confidence,
      action,
      recordedAt: Date.now(),
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch {
    // Feedback must never interrupt live presentation.
  }
}
