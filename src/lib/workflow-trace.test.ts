import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearWorkflowTrace,
  exportWorkflowTraceJson,
  getWorkflowTrace,
  recordWorkflowTrace,
} from "./workflow-trace"

describe("workflow trace", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-22T10:00:00Z"))
    clearWorkflowTrace()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("records structured workflow entries in order", () => {
    recordWorkflowTrace("transcription.final", "Final transcript received", {
      text: "John 3:16",
    })
    recordWorkflowTrace("detection.event", "Verse detections event received", {
      count: 1,
    })

    expect(getWorkflowTrace()).toEqual([
      expect.objectContaining({
        id: 1,
        at: Date.now(),
        stage: "transcription.final",
        summary: "Final transcript received",
        details: { text: "John 3:16" },
      }),
      expect.objectContaining({
        id: 2,
        at: Date.now(),
        stage: "detection.event",
        summary: "Verse detections event received",
        details: { count: 1 },
      }),
    ])
  })

  it("exposes a JSON export of the current trace", () => {
    recordWorkflowTrace("live.state", "Live screen shown", { isLive: true })

    expect(JSON.parse(exportWorkflowTraceJson())).toEqual([
      expect.objectContaining({
        stage: "live.state",
        details: { isLive: true },
      }),
    ])
  })
})
