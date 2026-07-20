import { beforeEach, describe, expect, it, vi } from "vitest"
import { recordDetectionFeedback } from "./detection-feedback"
import type { DetectionResult } from "@/types"

const detection: DetectionResult = {
  verse_ref: "John 3:16",
  verse_text: "For God so loved the world",
  book_name: "John",
  book_number: 43,
  chapter: 3,
  verse: 16,
  confidence: 0.91,
  rank_score: 0.84,
  source: "semantic",
  auto_queued: false,
  transcript_snippet: "private transcript",
  is_chapter_only: false,
}

describe("detection feedback", () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      clear: () => values.clear(),
    })
  })

  it("stores ranking feedback without transcript content", () => {
    recordDetectionFeedback(detection, "presented")

    const raw = localStorage.getItem("sabbathcue:detection-feedback:v1") ?? ""
    expect(raw).not.toContain("private transcript")
    expect(JSON.parse(raw)).toEqual([
      expect.objectContaining({
        reference: "John 3:16",
        source: "semantic",
        matchStrength: 0.91,
        rankScore: 0.84,
        action: "presented",
      }),
    ])
  })
})
