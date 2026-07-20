import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  getDetectionPerformanceSnapshot,
  observeDetectionCandidates,
  profileDetectionEvent,
  recordAutoSelectionPerformance,
  resetDetectionPerformanceForTests,
} from "./detection-profiler"

describe("detection performance profiler", () => {
  beforeEach(() => {
    resetDetectionPerformanceForTests()
    vi.spyOn(console, "info").mockImplementation(() => undefined)
  })

  it("counts top-candidate switches inside the stability window", () => {
    observeDetectionCandidates([{ verse_ref: "John 3:16", confidence: 0.91 }], 0)
    observeDetectionCandidates([{ verse_ref: "Romans 5:8", confidence: 0.92 }], 500)

    expect(getDetectionPerformanceSnapshot().topCandidateSwitches).toBe(1)
  })

  it("measures confirmation latency from first sighting to selection", () => {
    const candidate = { verse_ref: "John 3:16", confidence: 0.92 }
    observeDetectionCandidates([candidate], 1_000)
    recordAutoSelectionPerformance(candidate, 1_650)

    expect(getDetectionPerformanceSnapshot()).toMatchObject({
      autoSelections: 1,
      averageSelectionLatencyMs: 650,
      maxSelectionLatencyMs: 650,
    })
  })

  it("does not finish an asynchronous profile before the work settles", async () => {
    let resolveWork!: () => void
    const work = new Promise<void>((resolve) => {
      resolveWork = resolve
    })
    const profiled = profileDetectionEvent("verse_detections", 1, () => work)

    expect(console.info).not.toHaveBeenCalled()
    resolveWork()
    await profiled
    expect(console.info).toHaveBeenCalledOnce()
  })
})
